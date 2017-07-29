all:
	npm run build
	sudo systemctl restart grafana-server
