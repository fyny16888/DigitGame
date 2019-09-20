# Windows
###### 1. 下载[node-v4.4.7](https://nodejs.org/dist/v4.4.7/node-v4.4.7-x64.msi "node-v4.4.7")并安装。
###### 2. 下载[redis-server](https://github.com/MSOpenTech/redis/releases "redis-server")安装并启动。
###### 3. 下载[mongodb-server](https://www.mongodb.com/download-center "mongodb-server")安装并启动。
###### 4. 下载[Git](https://git-scm.com/downloads "git")并安装，将Git目录下的bin和usr\bin加入Path环境变量。
###### 5. 配置文件config\memdb.conf.js、config\development\memdb.json、config\development\servers.json。
- config\memdb.conf.js和config\development\memdb.json中backend.url即为mongodb地址。
- config\development\servers.json中clientIP和clientPort即为外网地址和端口。

###### 6. 启动缓存服务，工程目录下执行node_modules\\.bin\memdbcluster start -c config\memdb.conf.js。
###### 7. 启动游戏服务，工程目录下执行node_modules\\.bin\pomelo start。


# Linux
###### 1. 下载[node-v4.4.7](https://nodejs.org/dist/v4.4.7/node-v4.4.7-linux-x64.tar.gz "node-v4.4.7")并安装。
###### 2. 下载redis-server安装并启动。
```
# ubuntu
sudo apt-get install -y redis-server
# centos
sudo yum install -y redis-server
```
###### 3. 下载mongodb-server安装并启动。
```
# ubuntu
sudo apt-get install -y mongodb-server
# centos
sudo yum install -y mongodb-server
```
###### 4. 重新编译node_modules，工程目录下执行npm rebuild，确保无ERROR。
###### 5. 配置文件config/memdb.conf.js、config/development/memdb.json、config/development/servers.json。
- config/memdb.conf.js和config/development/memdb.json中backend.url即为mongodb地址。
- config/development/servers.json中clientIP和clientPort即为外网地址和端口。

###### 6. 启动缓存服务，工程目录下执行node_modules/.bin/memdbcluster start -c config/memdb.conf.js。
###### 7. 启动游戏服务，工程目录下执行node_modules/.bin/pomelo start。

