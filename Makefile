.PHONY: build dev test lint tidy clean demo

build:
	pnpm --filter @diffboard/core run build
	pnpm --filter @diffboard/server run build
	pnpm --filter diffboard run build

dev:
	pnpm --filter @diffboard/server run dev

test:
	pnpm --filter @diffboard/core run test
	pnpm --filter @diffboard/server run test
	pnpm --filter diffboard run test

lint:
	pnpm --filter @diffboard/core run lint
	pnpm --filter @diffboard/server run lint
	pnpm --filter diffboard run lint

tidy:
	pnpm install

clean:
	rm -rf packages/*/dist packages/server/.next node_modules packages/*/node_modules

# Boots the real stack, records a genuine walkthrough, and converts it into
# docs/assets/demo.mp4 + demo.gif for the README. See scripts/record-demo/README.md.
demo:
	cd scripts/record-demo && npm install
	cd scripts/record-demo && npm run record
	cd scripts/record-demo && npm run convert
