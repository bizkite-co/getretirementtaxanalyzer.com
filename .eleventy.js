const markdownIt = require("markdown-it");
const Image = require("@11ty/eleventy-img");
const Nunjucks = require("nunjucks");

module.exports = function(eleventyConfig) {

  eleventyConfig.addPassthroughCopy("src/assets/");

  eleventyConfig.addPairedNunjucksShortcode("markdown", (content) => {
    return new Nunjucks.runtime.SafeString(markdownIt().render(content));
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
      class: "img-fluid",
    };

    return Image.generateHTML(metadata, imageAttributes);
  });

  // Add collections for key-features and testimonials
  eleventyConfig.addCollection("keyFeatures", function(collectionApi) {
    return collectionApi.getFilteredByGlob("src/key-features/*.md").sort((a, b) => a.data.order - b.data.order);
  });

  eleventyConfig.addCollection("testimonials", function(collectionApi) {
    return collectionApi.getFilteredByGlob("src/testimonials/*.md");
  });

  return {
    dir: {
      input: "src",
      includes: "_includes",
      output: "_site"
    },
    htmlTemplateEngine: "njk",
    markdownTemplateEngine: "njk" // Explicitly set Markdown engine to Nunjucks
  };
};