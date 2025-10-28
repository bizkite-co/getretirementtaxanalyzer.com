#!/usr/bin/env bash
.PHONY: help build start watch

help: ## Display this help screen
	@echo "Available commands:"
	@awk 'BEGIN {FS = ":.*?## "}; /^[a-zA-Z_-]+:.*?## / {printf "  \033[32m%-20s\033[0m %s\n", $$1, $$2}' $(MAKEFILE_LIST)

# ==============================================================================
# Application Tasks
# ==============================================================================

build: ## Build the Eleventy site and CSS
	npx @11ty/eleventy

start: ## Start the development server with live reload
	npx @11ty/eleventy --serve

watch: ## Watch for changes and rebuild (without serving)
	npx @11ty/eleventy --watch