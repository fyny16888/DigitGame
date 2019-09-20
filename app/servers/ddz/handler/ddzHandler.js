'use strict';

var quick = require('quick-pomelo');
var P = quick.Promise;
var _ = require('lodash');
var C = require('../../../../share/constant');

var Handler = function (app) {
    this.app = app;
};

module.exports = function (app) {
    return new Handler(app);
};

var proto = Handler.prototype;

// 加入桌子
proto.joinTable = P.coroutine(function* (msg, session, next) {
    if (!session.uid) {
        return next(null, { code: C.ERROR, msg: C.PLAYER_NOT_LOGIN });
    }
    if (!msg.tableId) {
        return next(null, { code: C.FAILD, msg: C.GAME_PARAM_ERROR });
    }
    return this.app.controllers.ddz.joinTableAsync(session.uid, String(msg.tableId)).nodeify(next);
});

// 创建桌子
proto.createTable = P.coroutine(function* (msg, session, next) {
    if (!session.uid) {
        return next(null, { code: C.ERROR, msg: C.PLAYER_NOT_LOGIN });
    }
    return this.app.controllers.ddz.createTableAsync(session.uid,msg.difen).nodeify(next);
});

// 离开桌子
proto.leaveTable = P.coroutine(function* (msg, session, next) {
    if (!session.uid) {
        return next(null, { code: C.ERROR, msg: C.PLAYER_NOT_LOGIN });
    }
    return this.app.controllers.ddz.leaveTableAsync(session.uid).nodeify(next);
});

// 开始游戏
proto.startGame = P.coroutine(function* (msg, session, next) {
    if (!session.uid) {
        return next(null, { code: C.ERROR, msg: C.PLAYER_NOT_LOGIN });
    }
    return this.app.controllers.ddz.startGameAsync(session.uid).nodeify(next);
});

// 出牌
proto.chupai = P.coroutine(function* (msg, session, next) {
    if (!session.uid) {
        return next(null, { code: C.ERROR, msg: C.PLAYER_NOT_LOGIN });
    }
    return this.app.controllers.ddz.chuPaiAsync(session.uid,msg.pokers).nodeify(next);
});

// 叫分
proto.jiaofen = P.coroutine(function* (msg, session, next) {
    if (!session.uid) {
        return next(null, { code: C.ERROR, msg: C.PLAYER_NOT_LOGIN });
    }
    return this.app.controllers.ddz.jiaoFenAsync(session.uid,msg.score).nodeify(next);
});

// 是否重新开始
proto.againGame = P.coroutine(function* (msg, session, next) {
    if (!session.uid) {
        return next(null, { code: C.ERROR, msg: C.PLAYER_NOT_LOGIN });
    }
    var result = yield this.app.controllers.ddz.againGameAsync(session.uid,true);
    let nexts = result.nexts || [];
    if (result.nexts) delete result.nexts;
    next(null, result);
    for (let func of nexts) yield func();
});

// 准备状态
proto.gameReady = P.coroutine(function* (msg, session, next) {
    if (!session.uid) {
        return next(null, { code: C.ERROR, msg: C.PLAYER_NOT_LOGIN });
    }
    return this.app.controllers.ddz.gameReadyAsync(session.uid).nodeify(next);
});

// 选择倍数
proto.setMultiple = P.coroutine(function* (msg, session, next) {
    if (!session.uid) {
        return next(null, { code: C.ERROR, msg: C.PLAYER_NOT_LOGIN });
    }
    if (!msg.mul) {
         return next(null, { code: C.FAILD, msg: C.TABLE_MUL_ERROR });
    }
    return this.app.controllers.ddz.setMultipleAsync(session.uid, Number(msg.mul)).nodeify(next);
});

// 提交牌
proto.commitCard = P.coroutine(function* (msg, session, next) {
    if (!session.uid) {
        return next(null, { code: C.ERROR, msg: C.PLAYER_NOT_LOGIN });
    }
    if (typeof msg.niu == 'undefined') {
         return next(null, { code: C.FAILD, msg: C.TABLE_COMMIT_ERROR });
    }
    return this.app.controllers.ddz.commitCardAsync(session.uid, Number(msg.niu)).nodeify(next);
});

