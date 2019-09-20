'use strict';

var quick = require('quick-pomelo');
var P = quick.Promise;
var logger = quick.logger.getLogger('gate', __filename);

// 构造方法
var Controller = function (app) {
	this.app = app;
	this.completed = false;
	if (app.getServerType() == 'gate') {
		app.event.on('start_all', () => {
			this.completed = true;
		});
	}
};

// 导出方法
module.exports = function (app) {
    return new Controller(app);
};

// 原型对象
var proto = Controller.prototype;

// 是否完全启动
proto.isCompleted = function () {
	return this.completed;
};

