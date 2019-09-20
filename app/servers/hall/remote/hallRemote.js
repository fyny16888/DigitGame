'use strict';

var P = require('quick-pomelo').Promise;
var logger = require('quick-pomelo').logger.getLogger('hallRemote', __filename);

var Remote = function (app) {
    this.app = app;
};

module.exports = function (app) {
    return new Remote(app);
};

/**
 * 更新任务状态
 * @ ids 需要更新的玩家ID数组
 * @ taskType 任务类型   1 胜利任务
 * @ cb 回调
 */
Remote.prototype.updateTaskStatus = function (ids, taskType, cb) {
    logger.info('===hallRemote.prototype.updateTaskStatus: %s, args: %j===', this.app.getServerId(), arguments);
    var self = this;
    var app = this.app;
    return app.memdb.goose.transactionAsync(P.coroutine(function* () {
        return app.controllers.hall.updateTaskStatusAsync(ids, taskType);
    }), app.getServerId())
        .then(() => app.event.emit('transactionSuccess'), () => app.event.emit('transactionFail'))
        .nodeify(cb);
};

/**
 * 发送广播
 * @uid { String } 玩家ID
 * msg  { String } 消息
 * cb   { Function } 回调
 */
Remote.prototype.broadcast = function (msg, cb) {
    logger.info('===hallRemote.prototype.broadcast: %s, args: %j===', this.app.getServerId(), arguments);
    return this.app.controllers.hall.broadcastAsync(null, msg)
        .nodeify(cb);
};

