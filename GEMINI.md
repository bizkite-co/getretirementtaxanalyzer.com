# Project Overview: getretirementtaxanalyzer.com

This project is a static marketing website for "The Roadmap," a retirement spend-down table application. It is designed to help financial advisors visualize and explain long-term retirement income projections to their clients.

## Technologies Used

*   **Static Site Generator:** Eleventy (11ty)
*   **Styling:** Tailwind CSS with PostCSS
*   **Templating:** Nunjucks and Markdown
*   **Deployment:** GitHub Pages via GitHub Actions

## Project Structure

*   `src/`: Contains the source files for the Eleventy site.
    *   `src/_includes/`: Nunjucks templates and Markdown content.
    *   `src/assets/`: Static assets such as images and JavaScript files.
*   `_site/`: The output directory where the generated static site is built.
*   `.github/workflows/`: Contains the GitHub Actions workflow for deployment.

## Building and Running

To set up and run the project locally:

1.  **Install Dependencies:**
    ```bash
    npm install
    ```

2.  **Run in Development Mode (with live reload):**
    ```bash
    npm start
    ```
    This command will compile CSS with PostCSS and Tailwind, and serve the Eleventy site with live reloading.

3.  **Build for Production:**
    ```bash
    npm run build
    ```
    This command will generate the static site in the `_site` directory.

## Deployment

The site is automatically deployed to GitHub Pages via a GitHub Actions workflow defined in `.github/workflows/deploy.yml` on pushes to the `main` branch.

## Development Conventions

*   **Styling:** Uses Tailwind CSS for utility-first styling.
*   **Content:** Markdown is used for content, processed by Eleventy.
*   **Images:** Eleventy Image plugin is used for responsive image generation.
