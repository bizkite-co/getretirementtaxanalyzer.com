#!/usr/bin/env bash
.PHONY: help build start watch

help: ## Display this help screen
	@echo "Available commands:"
	@awk 'BEGIN {FS = ":.*?## "}; /^[a-zA-Z_-]+:.*?## / {printf "  \033[32m%-20s\033[0m %s\n", $$1, $$2}' $(MAKEFILE_LIST)

# ==============================================================================
# Application Tasks
# ==============================================================================

build: ## Build the Eleventy site and CSS
	npx postcss-cli src/style.css -o _site/style.css
	npx @11ty/eleventy

start: ## Start the development server with live reload
	npx postcss-cli src/style.css -o _site/style.css --watch & npx @11ty/eleventy --serve

watch: ## Watch for changes and rebuild (without serving)
	npx postcss-cli src/style.css -o _site/style.css --watch & npx @11ty/eleventy --watch