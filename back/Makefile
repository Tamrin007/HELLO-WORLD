setup:
	which docker || brew cask install docker
	which go || brew install go
	which godep || go get github.com/tools/godep
	godep restore

save:
	godep save

build:
	go build server.go

run:
	make build && ./server

clean:
	[ -e ./server ] && rm server || find ./public && rm -rf ./public

migrate:
	cp -rf ../front/public ./public

docker-build:
	docker build -t exec-container .

deploy:
	sudo service nginx restart
	killall server || true
	git pull origin master
	make clean
	go build server.go
	make migrate
	export GIN_MODE=release
	nohup ./server &
