const path = require("path");
const sharp = require("sharp");
const eleventyImage = require("@11ty/eleventy-img");
const eleventyNavigationPlugin = require("@11ty/eleventy-navigation");

// ESM default export when loaded from this CommonJS config.
const optimizeImage = eleventyImage.default;

// Source files that no template references. They stay in src/img (they may be
// useful later) but are not copied into the deploy output:
//   fingerloop-1.png, fingerloop-2.png, fingerloop-4.png,
//   ll-luna-fetch.gif (~12.8 MB), luna-blue-leaves.jpg, luna-blue.jpg,
//   step-1b.png, step-3b.png, step-4b.jpg

// Keep a width only when it is meaningfully smaller than the original, then
// always include the original so the width/height attributes match the source.
function defaultWidths(originalWidth) {
    const steps = [480, 800, 1200].filter((width) => originalWidth - width >= 80);
    return [...steps, null];
}

module.exports = function (eleventyConfig) {
    eleventyConfig.addPlugin(eleventyNavigationPlugin);

    // Favicon is requested at /favicon.ico. The hero PNG is the Open Graph
    // image and must stay at the URL already published in the head metadata.
    // Every other content image is emitted by the image shortcode below.
    eleventyConfig.addPassthroughCopy({ "src/img/favicon": "/" });
    eleventyConfig.addPassthroughCopy({
        "src/img/hero-banner-product.png": "img/hero-banner-product.png",
    });

    eleventyConfig.addNunjucksAsyncShortcode("image", async function (options) {
        if (!options || !options.src || options.alt === undefined) {
            throw new Error("The image shortcode requires src and alt.");
        }

        const inputPath = options.src.startsWith("/img/")
            ? path.join("src", options.src)
            : options.src;

        const image = sharp(inputPath);
        const meta = await image.metadata();
        const stats = meta.hasAlpha ? await image.stats() : null;
        const alpha = stats && stats.channels[3];
        // A fully opaque alpha channel does not need a PNG fallback. JPEG is
        // much smaller for the photographs, and AVIF/WebP still go first.
        const usesAlpha = Boolean(alpha && alpha.min < 255);
        const formats = options.formats || (usesAlpha
            ? ["avif", "webp", "png"]
            : ["avif", "webp", "jpeg"]);

        const metadata = await optimizeImage(inputPath, {
            widths: options.widths || defaultWidths(meta.width),
            formats,
            outputDir: "./_site/img/",
            urlPath: "/img/",
            filenameFormat: function (id, src, width, format) {
                const name = path.basename(src, path.extname(src));
                return `${name}-${width}w.${format}`;
            },
            sharpAvifOptions: { quality: 78, effort: 6 },
            sharpWebpOptions: { quality: 86, effort: 5 },
            sharpJpegOptions: { quality: 88, mozjpeg: true },
            // Lossless fallback so older browsers match the source pixels.
            sharpPngOptions: { compressionLevel: 9 },
        });

        const attributes = {
            alt: options.alt,
            sizes: options.sizes,
            loading: options.loading || "lazy",
            decoding: "async",
        };

        if (options.imgClass) {
            attributes.class = options.imgClass;
        }
        if (options.style) {
            attributes.style = options.style;
        }
        if (options.fetchpriority) {
            attributes.fetchpriority = options.fetchpriority;
        }

        return eleventyImage.generateHTML(metadata, attributes);
    });

    return {
        dir: { input: "src", output: "_site" },
    };
};
