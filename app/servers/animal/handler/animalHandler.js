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

// 加入游戏
proto.joinGame = P.coroutine(function* (msg, session, next) {
    if (!session.uid) {
        return next(null, { code: C.ERROR, msg: C.PLAYER_NOT_LOGIN });
    }
    return this.app.controllers.animal.joinGameAsync(session.uid).nodeify(next);
});

// 离开游戏
proto.leaveGame = P.coroutine(function* (msg, session, next) {
    if (!session.uid) {
        return next(null, { code: C.ERROR, msg: C.PLAYER_NOT_LOGIN });
    }
    return this.app.controllers.animal.leaveGameAsync(session.uid, Number(msg.cell)).nodeify(next);
});

// 同步下注
proto.getBets = P.coroutine(function* (msg, session, next) {
    if (!session.uid) {
        return next(null, { code: C.ERROR, msg: C.PLAYER_NOT_LOGIN });
    }
    return this.app.controllers.animal.getBetsAsync(session.uid).nodeify(next);
});

// 下注金币
proto.betGold = P.coroutine(function* (msg, session, next) {
    if (!session.uid) {
        return next(null, { code: C.ERROR, msg: C.PLAYER_NOT_LOGIN });
    }
    if (!_.isArray(msg.bets)) {
        return next(null, { code: C.FAILD, msg: C.GAME_PARAM_ERROR });
    }
    return this.app.controllers.animal.betGoldAsync(session.uid, msg.bets).nodeify(next);
});

// 上庄
proto.upToBanker = P.coroutine(function* (msg, session, next) {
    if (!session.uid) {
        return next(null, { code: C.ERROR, msg: C.PLAYER_NOT_LOGIN });
    }
    return this.app.controllers.animal.upToBankerAsync(session.uid).nodeify(next);
});

// 下庄
proto.downBanker = P.coroutine(function* (msg, session, next) {
    if (!session.uid) {
        return next(null, { code: C.ERROR, msg: C.PLAYER_NOT_LOGIN });
    }
    return this.app.controllers.animal.downBankerAsync(session.uid).nodeify(next);
});

// 获取排庄列表
proto.listBanker = P.coroutine(function* (msg, session, next) {
    if (!session.uid) {
        return next(null, { code: C.ERROR, msg: C.PLAYER_NOT_LOGIN });
    }
    return this.app.controllers.animal.listBankerAsync(session.uid).nodeify(next);
});

// 发红包
proto.redPack = P.coroutine(function* (msg, session, next) {
    if (!session.uid) {
        return next(null, { code: C.ERROR, msg: C.PLAYER_NOT_LOGIN });
    }
    var total = Number(msg.total);
    var count = Number(msg.count);
    if (!total || total < 0) {
        return next(null, { code: C.FAILD, msg: C.GAME_PARAM_ERROR });
    }
    if (!count || count < 0 || count > 50) {
        return next(null, { code: C.FAILD, msg: C.GAME_PARAM_ERROR });
    }
    return this.app.controllers.animal.redPackAsync(session.uid, total, count).nodeify(next);
});

// 发送喇叭
proto.broadcast = P.coroutine(function* (msg, session, next) {
    if (!session.uid) {
        return next(null, { code: C.ERROR, msg: C.PLAYER_NOT_LOGIN });
    }
    return this.app.controllers.animal.broadcastAsync(session.uid, msg).nodeify(next);
});

// 同步金币
proto.getGold = P.coroutine(function* (msg, session, next) {
	if (!session.uid) {
        return next(null, { code: C.ERROR, msg: C.PLAYER_NOT_LOGIN });
    }
	var player = yield this.app.models.Player.findByIdReadOnlyAsync(session.uid, 'gold');
	if (!player) {
		return next(null, { code: C.FAILD, msg: C.PLAYER_NOT_FOUND });
	}
	return next(null, { code: C.OK, data: { gold: String(player.gold) } });
});

