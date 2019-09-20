'use strict';

var quick = require('quick-pomelo');
var P = quick.Promise;
var _ = require('lodash');
var C = require('../../share/constant');
var logger = quick.logger.getLogger('user', __filename);

// 构造方法
var User = function (game, id, table) {
    this.game = game;
    this.table = table;
    this.id = id;
    this.hand = -1;
    this.chairId = -1;
};

// 导出类
module.exports = User;

var proto = User.prototype;