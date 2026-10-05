#!/usr/bin/env bash
.PHONY: help build start watch stop build-css

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

start: ## Start the dev server + CSS watcher detached in the background and print the local URL (stop with `make stop`)
	@mkdir -p logs
	@if [ -f logs/eleventy.pid ] && kill -0 "$$(cat logs/eleventy.pid)" 2>/dev/null; then \
		echo "Already running - run 'make stop' first if you want to restart it."; \
		exit 1; \
	fi
	@rm -f logs/eleventy.log
	@nohup ./node_modules/.bin/postcss src/style.css -o _site/style.css --watch > logs/postcss.log 2>&1 < /dev/null & echo $$! > logs/postcss.pid
	@nohup ./node_modules/.bin/eleventy --serve --port 8081 > logs/eleventy.log 2>&1 < /dev/null & echo $$! > logs/eleventy.pid
	@echo "Waiting for the dev server to come up..."
	@for i in $$(seq 1 40); do \
		url=$$(grep -o 'http://localhost:[0-9]*/' logs/eleventy.log 2>/dev/null | tail -1); \
		if [ -n "$$url" ]; then \
			echo ""; \
			echo "Dev server running (detached) at: $$url"; \
			echo "  Logs: logs/eleventy.log  logs/postcss.log"; \
			echo "  Stop with: make stop"; \
			exit 0; \
		fi; \
		sleep 0.5; \
	done; \
	echo "Timed out waiting for the server to report its URL - check logs/eleventy.log:"; tail -20 logs/eleventy.log; exit 1

stop: ## Stop the dev server + CSS watcher started by `make start`
	@if [ -f logs/eleventy.pid ] && kill "$$(cat logs/eleventy.pid)" 2>/dev/null; then \
		echo "Stopped dev server (PID $$(cat logs/eleventy.pid))."; \
	else \
		echo "No dev server was running (or it was already stopped)."; \
	fi
	@rm -f logs/eleventy.pid
	@if [ -f logs/postcss.pid ] && kill "$$(cat logs/postcss.pid)" 2>/dev/null; then \
		echo "Stopped CSS watcher (PID $$(cat logs/postcss.pid))."; \
	else \
		echo "No CSS watcher was running (or it was already stopped)."; \
	fi
	@rm -f logs/postcss.pid

watch: ## Watch for changes, rebuild, and serve locally in the foreground - prints the local URL; Ctrl+C to stop
	./node_modules/.bin/postcss src/style.css -o _site/style.css --watch & ./node_modules/.bin/eleventy --serve --port 8081