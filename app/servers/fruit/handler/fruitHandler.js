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
    return this.app.controllers.fruit.joinGameAsync(session.uid).nodeify(next);
});

// 离开游戏
proto.leaveGame = P.coroutine(function* (msg, session, next) {
    if (!session.uid) {
        return next(null, { code: C.ERROR, msg: C.PLAYER_NOT_LOGIN });
    }
    return this.app.controllers.fruit.leaveGameAsync(session.uid, Number(msg.cell)).nodeify(next);
});

// 同步下注
proto.getBets = P.coroutine(function* (msg, session, next) {
    if (!session.uid) {
        return next(null, { code: C.ERROR, msg: C.PLAYER_NOT_LOGIN });
    }
    return this.app.controllers.fruit.getBetsAsync(session.uid).nodeify(next);
});

// 下注金币
proto.betGold = P.coroutine(function* (msg, session, next) {
    if (!session.uid) {
        return next(null, { code: C.ERROR, msg: C.PLAYER_NOT_LOGIN });
    }
    if (!_.isArray(msg.bets)) {
        return next(null, { code: C.FAILD, msg: C.GAME_PARAM_ERROR });
    }
    return this.app.controllers.fruit.betGoldAsync(session.uid, msg.bets).nodeify(next);
});

// 上庄
proto.upToBanker = P.coroutine(function* (msg, session, next) {
    if (!session.uid) {
        return next(null, { code: C.ERROR, msg: C.PLAYER_NOT_LOGIN });
    }
    return this.app.controllers.fruit.upToBankerAsync(session.uid).nodeify(next);
});

// 下庄
proto.downBanker = P.coroutine(function* (msg, session, next) {
    if (!session.uid) {
        return next(null, { code: C.ERROR, msg: C.PLAYER_NOT_LOGIN });
    }
    return this.app.controllers.fruit.downBankerAsync(session.uid).nodeify(next);
});

// 获取排庄列表
proto.listBanker = P.coroutine(function* (msg, session, next) {
    if (!session.uid) {
        return next(null, { code: C.ERROR, msg: C.PLAYER_NOT_LOGIN });
    }
    return this.app.controllers.fruit.listBankerAsync(session.uid).nodeify(next);
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
    return this.app.controllers.fruit.redPackAsync(session.uid, total, count).nodeify(next);
});

// 发送喇叭
proto.broadcast = P.coroutine(function* (msg, session, next) {
    if (!session.uid) {
        return next(null, { code: C.ERROR, msg: C.PLAYER_NOT_LOGIN });
    }
    return this.app.controllers.fruit.broadcastAsync(session.uid, msg).nodeify(next);
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

// 单局应最多玩家
proto.getMaxWinner = P.coroutine(function* (msg, session, next) {
    if (!session.uid) {
        return next(null, { code: C.ERROR, msg: C.PLAYER_NOT_LOGIN });
    }
    var gmax = { gmaxId: '', gmaxVal: 0 };
    var mainServer = this.app.getServersByType('fruit')[0];
    if (this.app.getServerId() == mainServer.id) {
        let fruit = this.app.controllers.fruit;
        gmax.gmaxId = fruit.gmaxId;
        gmax.gmaxVal = fruit.gmaxVal;
    } else {
        let fruitRemote = this.app.rpc.fruit.fruitRemote;
        gmax = yield P.promisify((cb) => fruitRemote.getGlobalMaxWinner.toServer(mainServer.id, cb))();
    }
    var data = { name: '', sex: '0', headurl: '', vip: 0, value: 0 };
    if (gmax.gmaxId) {
        let player = yield this.app.models.Player.findByIdReadOnlyAsync(gmax.gmaxId, 'name sex headurl vip');
        if (player) {
            data.name = player.name;
            data.sex = player.sex;
            data.headurl = player.headurl;
            data.vip = player.vip;
            data.value = gmax.gmaxVal;
        }
    }
    return next(null, { code: C.OK, data: data });
});

