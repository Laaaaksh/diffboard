.PHONY: build dev test lint tidy clean

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
