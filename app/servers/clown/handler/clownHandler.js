'use strict';

var quick = require('quick-pomelo');
var P = quick.Promise;
var _ = require('lodash');
var C = require('../../../../share/constant');

var Handler = function (app) {
    this.app = app;

    this.giftTime = 0;
    this.gifCache = 0;

    this.dayTime = 0;
    this.dayRank = [];

    this.weekTime = 0;
    this.weekRank = [];
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
    return this.app.controllers.clown.joinGameAsync(session.uid).nodeify(next);
});

// 离开游戏
proto.leaveGame = P.coroutine(function* (msg, session, next) {
    if (!session.uid) {
        return next(null, { code: C.ERROR, msg: C.PLAYER_NOT_LOGIN });
    }
    return this.app.controllers.clown.leaveGameAsync(session.uid).nodeify(next);
});

// 请求转盘
proto.randResult = P.coroutine(function* (msg, session, next) {
    if (!session.uid) {
        return next(null, { code: C.ERROR, msg: C.PLAYER_NOT_LOGIN });
    }
    var cell = Number(msg.cell);
    if (!cell || cell < 20) {
        return next(null, { code: C.FAILD, msg: C.GAME_PARAM_ERROR });
    }
    return this.app.controllers.clown.randResultAsync(session.uid, cell).nodeify(next);
});

// 选择小丑
proto.chooseClown = P.coroutine(function* (msg, session, next) {
    if (!session.uid) {
        return next(null, { code: C.ERROR, msg: C.PLAYER_NOT_LOGIN });
    }
    var plusMul = msg.plus;
    return this.app.controllers.clown.chooseClownAsync(session.uid, !!plusMul).nodeify(next);
});

// 结束选择
proto.endChoose = P.coroutine(function* (msg, session, next) {
    if (!session.uid) {
        return next(null, { code: C.ERROR, msg: C.PLAYER_NOT_LOGIN });
    }
    return this.app.controllers.clown.endChooseAsync(session.uid).nodeify(next);
});

// 同步彩金
proto.getGift = P.coroutine(function* (msg, session, next) {
    if (!session.uid) {
        return next(null, { code: C.ERROR, msg: C.PLAYER_NOT_LOGIN });
    }
    var nowTime = Date.now();
    if (nowTime - this.giftTime > 5000) {
        let gameId = this.app.controllers.clown.id;
        let clownInfo = yield this.app.models.ClownInfo.findByIdAsync(gameId, 'tGift');
        if (clownInfo) {
            this.gifCache = clownInfo.tGift
            this.giftTime = nowTime;
            let clown = this.app.controllers.clown;
            if (clown.addGift != 0) {
                clownInfo.tGift += clown.addGift;
                clown.addGift = 0;
                if (clownInfo.tGift < 0) clownInfo.tGift = 0;
                yield clownInfo.saveAsync();
            }
        }
    }
    return next(null, { code: C.OK, gift: this.gifCache });
});

// 获取日排名
proto.getDayRank = P.coroutine(function* (msg, session, next) {
    if (!session.uid) {
        return next(null, { code: C.ERROR, msg: C.PLAYER_NOT_LOGIN });
    }
    var nowTime = Date.now();
    if (nowTime - this.dayTime > 600000) {
        let today = new Date(nowTime);
        today.setHours(0);
        today.setMinutes(0);
        today.setSeconds(0);
        today.setMilliseconds(0);
        let players = yield this.app.models.ClownPlayer.findMongoAsync({ lastTime: { $gte: today.getTime() } }, 'name sex headurl dWin', { sort: { dWin: -1 }, limit: 20 });
        if (players.length > 0) {
            this.dayRank = players.map((i) => ({ name: i.name, sex: i.sex, headurl: i.headurl, win: i.dWin }));
            this.dayTime = nowTime;
        }
    }
    return next(null, { code: C.OK, list: this.dayRank });
});

// 获取周排名
proto.getWeekRank = P.coroutine(function* (msg, session, next) {
    if (!session.uid) {
        return next(null, { code: C.ERROR, msg: C.PLAYER_NOT_LOGIN });
    }
    var nowTime = Date.now();
    if (nowTime - this.weekTime > 600000) {
        let today = new Date(nowTime);
        today.setHours(0);
        today.setMinutes(0);
        today.setSeconds(0);
        today.setMilliseconds(0);
        let day = today.getDay();
        let sunday = new Date(today.getTime() - day * 86400000);
        let players = yield this.app.models.ClownPlayer.findMongoAsync({ lastTime: { $gte: sunday.getTime() } }, 'name sex headurl wWin', { sort: { wWin: -1 }, limit: 20 });
        if (players.length > 0) {
            this.weekRank = players.map((i) => ({ name: i.name, sex: i.sex, headurl: i.headurl, win: i.wWin }));
            this.weekTime = nowTime;
        }
    }
    return next(null, { code: C.OK, list: this.weekRank });
});

// 获取消息
proto.getMessages = function (msg, session, next) {
    if (!session.uid) {
        return next(null, { code: C.ERROR, msg: C.PLAYER_NOT_LOGIN });
    }
    var messages = this.app.controllers.clown.messages;
    return next(null, { code: C.OK, list: messages });
};

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
    return this.app.controllers.clown.redPackAsync(session.uid, total, count).nodeify(next);
});

