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
    return this.app.controllers.golden.joinGameAsync(session.uid).nodeify(next);
});

// 离开游戏
proto.leaveGame = P.coroutine(function* (msg, session, next) {
    if (!session.uid) {
        return next(null, { code: C.ERROR, msg: C.PLAYER_NOT_LOGIN });
    }
    return this.app.controllers.golden.leaveGameAsync(session.uid).nodeify(next);
});

// 同步下注
proto.getBets = P.coroutine(function* (msg, session, next) {
    if (!session.uid) {
        return next(null, { code: C.ERROR, msg: C.PLAYER_NOT_LOGIN });
    }
    return this.app.controllers.golden.getBetsAsync(session.uid).nodeify(next);
});

// 下注金币
proto.betGold = P.coroutine(function* (msg, session, next) {
    if (!session.uid) {
        return next(null, { code: C.ERROR, msg: C.PLAYER_NOT_LOGIN });
    }
    if (!msg.betId || !msg.gold) {
        return next(null, { code: C.FAILD, msg: C.GAME_PARAM_ERROR });
    }
    return this.app.controllers.golden.downBetAsync(session.uid, Number(msg.gold), Number(msg.betId)).nodeify(next);
});
// 上庄
proto.upToBanker = P.coroutine(function* (msg, session, next) {
    if (!session.uid) {
        return next(null, { code: C.ERROR, msg: C.PLAYER_NOT_LOGIN });
    }
    return this.app.controllers.golden.upBankerAsync(session.uid).nodeify(next);
});

// 下庄
proto.downBanker = P.coroutine(function* (msg, session, next) {
    if (!session.uid) {
        return next(null, { code: C.ERROR, msg: C.PLAYER_NOT_LOGIN });
    }
    return this.app.controllers.golden.downBankerAsync(session.uid).nodeify(next);
});

// 坐下
proto.downSeat = P.coroutine(function* (msg, session, next) {
    if (!session.uid) {
        return next(null, { code: C.ERROR, msg: C.PLAYER_NOT_LOGIN });
    }
    return this.app.controllers.golden.downSeatAsync(session.uid, Number(msg.seat)).nodeify(next);
});

// 获取牌庄列表
proto.listBanker = P.coroutine(function* (msg, session, next) {
    if (!session.uid) {
        return next(null, { code: C.ERROR, msg: C.PLAYER_NOT_LOGIN });
    }
    return this.app.controllers.golden.listBankerAsync(session.uid).nodeify(next);
});

// 获取游戏记录
proto.getGameRecord = P.coroutine(function* (msg, session, next) {
    if (!session.uid) {
        return next(null, { code: C.ERROR, msg: C.PLAYER_NOT_LOGIN });
    }
    return this.app.controllers.golden.getRecordAsync(session.uid).nodeify(next);
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
    return this.app.controllers.golden.redPackAsync(session.uid, total, count).nodeify(next);
});

// 发送喇叭
proto.broadcast = P.coroutine(function* (msg, session, next) {
    if (!session.uid) {
        return next(null, { code: C.ERROR, msg: C.PLAYER_NOT_LOGIN });
    }
    return this.app.controllers.golden.broadcastAsync(session.uid, msg).nodeify(next);
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

