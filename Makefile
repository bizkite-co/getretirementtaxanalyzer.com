#!/usr/bin/env bash
.PHONY: help build start watch build-css

help: ## Display this help screen
	@echo "Available commands:"
	@awk 'BEGIN {FS = ":.*?## "}; /^[a-zA-Z_-]+:.*?## / {printf "  \033[32m%-20s\033[0m %s\n", $$1, $$2}' $(MAKEFILE_LIST)

# ==============================================================================
# Application Tasks
# ==============================================================================

build: build-css ## Build the Eleventy site and CSS
	mkdir -p logs && DEBUG=Eleventy* npx @11ty/eleventy

build-css: ## Compile CSS with PostCSS and Tailwind
	npx postcss-cli src/style.css -o _site/style.css

start: ## Start the development server with live reload
	npx postcss-cli src/style.css -o _site/style.css --watch & DEBUG=Eleventy* npx @11ty/eleventy --serve --port 8081 > logs/eleventy.log 2>&1

watch: ## Watch for changes and rebuild (without serving)
	npx postcss-cli src/style.css -o _site/style.css --watch & npx @11ty/eleventy --watch