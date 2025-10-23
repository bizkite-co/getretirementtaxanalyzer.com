const markdownIt = require("markdown-it");
const Image = require("@11ty/eleventy-img");

module.exports = function(eleventyConfig) {

  eleventyConfig.addPassthroughCopy("src/assets/");



  eleventyConfig.addPairedNunjucksShortcode("markdown", (content) => {
    return markdownIt().render(content);
  });

  eleventyConfig.addNunjucksAsyncShortcode("image", async (src, alt, widths, sizes) => {
    let metadata = await Image(src, {
      widths: widths || [null],
      formats: ["webp", "jpeg"],
      outputDir: "./_site/img/",
      urlPath: "/img/",
    });

    let imageAttributes = {
      alt,
      sizes,
      loading: "lazy",
      decoding: "async",
    };

    return Image.generateHTML(metadata, imageAttributes);
  });

  return {
    dir: {
      input: "src",
      includes: "_includes",
      output: "_site"
    },
    htmlTemplateEngine: "njk"
  };
};