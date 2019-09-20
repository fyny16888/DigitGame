'use strict';

var quick = require('quick-pomelo');
var P = quick.Promise;
var util = require('util');
var _ = require('lodash');
var C = require('../../../../share/constant');

var Handler = function (app) {
    this.app = app;
    this.ovrp = {};
    this.rank = {
        list: [],
        atTime: 0
    };
    this.rankTime = 0;
    this.winsRank = [];
    this.lostRank = [];
};

module.exports = function (app) {
    return new Handler(app);
};

var proto = Handler.prototype;

var cor = P.coroutine;

//获取任务列表
proto.getTaskList = cor(function* (msg, session, next) {
    if (!session.uid) {
        return next(null, { code: C.ERROR, msg: C.PLAYER_NOT_LOGIN });
    }
    return this.app.controllers.hall.getTaskListAsync(session.uid).nodeify(next);
});

//获取任务奖励
proto.getTaskGift = cor(function* (msg, session, next) {
    if (!session.uid) {
        return next(null, { code: C.ERROR, msg: C.PLAYER_NOT_LOGIN });
    }
    return this.app.controllers.hall.getTaskGiftAsync(session.uid, Number(msg.taskId)).nodeify(next);
});

//获取打赏信息
proto.getRewardList = cor(function* (msg, session, next) {
    if (!session.uid) {
        return next(null, { code: C.ERROR, msg: C.PLAYER_NOT_LOGIN });
    }
    return this.app.controllers.hall.getRewardListAsync(session.uid).nodeify(next);
});

//发布打赏信息
proto.releaseReward = cor(function* (msg, session, next) {
    if (!session.uid) {
        return next(null, { code: C.ERROR, msg: C.PLAYER_NOT_LOGIN });
    }
    return this.app.controllers.hall.addRewardAsync(session.uid, Number(msg.gold), msg.describe, msg.title).nodeify(next);
});

//给打赏
proto.giveReward = cor(function* (msg, session, next) {
    if (!session.uid) {
        return next(null, { code: C.ERROR, msg: C.PLAYER_NOT_LOGIN });
    }
    return this.app.controllers.hall.giveRewardAsync(session.uid, msg.dsId, Number(msg.gold)).nodeify(next);
});

//获取摇钱树信息
proto.getMoneyTree = cor(function* (msg, session, next) {
    if (!session.uid) {
        return next(null, { code: C.ERROR, msg: C.PLAYER_NOT_LOGIN });
    }
    return this.app.controllers.hall.getMoneyTreeAsync(session.uid).nodeify(next);
});

//获取摇钱树上的金币
proto.getMoneyFromTree = cor(function* (msg, session, next) {
    if (!session.uid) {
        return next(null, { code: C.ERROR, msg: C.PLAYER_NOT_LOGIN });
    }
    return this.app.controllers.hall.getMoneyFromTreeAsync(session.uid).nodeify(next);
});

//获取奖品列表
proto.getGiftList = cor(function* (msg, session, next) {
    if (!session.uid) {
        return next(null, { code: C.ERROR, msg: C.PLAYER_NOT_LOGIN });
    }
    return this.app.controllers.hall.getGiftListAsync(session.uid).nodeify(next);
});

//兑换奖品
proto.exchangeGift = cor(function* (msg, session, next) {
    if (!session.uid) {
        return next(null, { code: C.ERROR, msg: C.PLAYER_NOT_LOGIN });
    }
    return this.app.controllers.hall.exchangeGiftAsync(session.uid, Number(msg.giftId)).nodeify(next);
});

//获取奖品记录
proto.getExchangeRecord = cor(function* (msg, session, next) {
    if (!session.uid) {
        return next(null, { code: C.ERROR, msg: C.PLAYER_NOT_LOGIN });
    }
    return this.app.controllers.hall.exchangeRecordAsync(session.uid).nodeify(next);
});

//获取个人奖品记录
proto.getSelfExchangeRecord = cor(function* (msg, session, next) {
    if (!session.uid) {
        return next(null, { code: C.ERROR, msg: C.PLAYER_NOT_LOGIN });
    }
    return this.app.controllers.hall.exchangeListAsync(session.uid).nodeify(next);
});

//获取签到次数
proto.getSignCount = cor(function* (msg, session, next) {
    if (!session.uid) {
        return next(null, { code: C.ERROR, msg: C.PLAYER_NOT_LOGIN });
    }
    return this.app.controllers.hall.getSignCountAsync(session.uid).nodeify(next);
});

//签到奖励
proto.sign = cor(function* (msg, session, next) {
    if (!session.uid) {
        return next(null, { code: C.ERROR, msg: C.PLAYER_NOT_LOGIN });
    }
    return this.app.controllers.hall.signAsync(session.uid).nodeify(next);
});

// 获取商城物品
proto.getShopList = cor(function* (msg, session, next) {
    if (!session.uid) {
        return next(null, { code: C.ERROR, msg: C.PLAYER_NOT_LOGIN });
    }
    var shoplist1 = yield this.app.models.Shop.findReadOnlyAsync({ type: 1 });
    var shoplist3 = yield this.app.models.Shop.findReadOnlyAsync({ type: 3 });
    var shoplist = shoplist1.concat(shoplist3);
    shoplist.sort((a, b) => (a._id - b._id));
    return next(null, { code: C.OK, list: shoplist });
});

// 获取排行榜
proto.getRankList = cor(function* (msg, session, next) {
    if (!session.uid) {
        return next(null, { code: C.ERROR, msg: C.PLAYER_NOT_LOGIN });
    }
    var nowTime = Date.now();
    if (this.rank.list.length <= 0 || nowTime - this.rank.atTime >= 30000) {
        let players = yield this.app.models.Player.findMongoAsync({ gold: { $gt: 100000 }, frozen: { $ne: 1 } }, 'name headurl gold vip', { sort: { gold: -1 }, limit: 20 });
        this.rank.atTime = nowTime;
        this.rank.list = players.map((p) => ({
            name: p.name,
            headurl: p.headurl,
            gold: p.gold,
            vip: p.vip
        }));
    }
    return next(null, { code: C.OK, list: this.rank.list });
});

// 获取保险箱
proto.getBank = cor(function* (msg, session, next) {
    if (!session.uid) {
        return next(null, { code: C.ERROR, msg: C.PLAYER_NOT_LOGIN });
    }
    var bank = 0;
    var player = yield this.app.models.Player.findByIdReadOnlyAsync(session.uid, 'bank');
    if (player) {
        bank = player.bank || 0;
    }
    return next(null, { code: C.OK, bank: String(bank) });
});

// 存入保险箱
proto.intoBank = cor(function* (msg, session, next) {
    if (!session.uid) {
        return next(null, { code: C.ERROR, msg: C.PLAYER_NOT_LOGIN });
    }
    var bank = Number(msg.bank);
    if (!bank || bank < 0) {
        return next(null, { code: C.FAILD, msg: C.HALL_PARAM_ERROR });
    }
    var player = yield this.app.models.Player.findByIdAsync(session.uid, 'vip gameServerId gold bank');
    if (!player) {
        return next(null, { code: C.FAILD, msg: C.PLAYER_NOT_FOUND });
    }
    if (player.vip < 1) {
        return next(null, { code: C.FAILD, msg: C.HALL_LOW_VIP });
    }
    if (player.gameServerId) {
        return next(null, { code: C.FAILD, msg: C.HALL_GAME_NOBANK });
    }
    if (player.gold < bank) {
        return next(null, { code: C.FAILD, msg: C.HALL_UNENOUGH_GOLD });
    }
    player.bank = (player.bank || 0) + bank;
    player.gold -= bank;
    yield player.saveAsync();
    return next(null, { code: C.OK });
});

// 取出保险箱
proto.outBank = cor(function* (msg, session, next) {
    if (!session.uid) {
        return next(null, { code: C.ERROR, msg: C.PLAYER_NOT_LOGIN });
    }
    var bank = Number(msg.bank);
    if (!bank || bank < 0) {
        return next(null, { code: C.FAILD, msg: C.HALL_PARAM_ERROR });
    }
    var player = yield this.app.models.Player.findByIdAsync(session.uid, 'vip bank gold');
    if (!player) {
        return next(null, { code: C.FAILD, msg: C.PLAYER_NOT_FOUND });
    }
    if (player.vip < 1) {
        return next(null, { code: C.FAILD, msg: C.HALL_LOW_VIP });
    }
    if (!player.bank || player.bank < bank) {
        return next(null, { code: C.FAILD, msg: C.HALL_UNENOUGH_BANK });
    }
    player.bank -= bank;
    player.gold += bank;
    yield player.saveAsync();
    return next(null, { code: C.OK });
});

// 发送大厅喇叭
proto.broadcast = cor(function* (msg, session, next) {
    if (!session.uid) {
        return next(null, { code: C.ERROR, msg: C.PLAYER_NOT_LOGIN });
    }
    return this.app.controllers.hall.broadcastAsync(session.uid, msg).nodeify(next);
});

// 抢红包
proto.grabRedPack = cor(function* (msg, session, next) {
    if (!session.uid) {
        return next(null, { code: C.ERROR, msg: C.PLAYER_NOT_LOGIN });
    }
    if (!msg.rid) {
        return next(null, { code: C.FAILD, msg: C.HALL_PARAM_ERROR });
    }
    if (this.ovrp[msg.rid]) {
        return next(null, { code: C.OK, gold: String(0) });
    }
    var redpack = yield this.app.models.RedPack.findByIdAsync(msg.rid);
    if (!redpack) {
        return next(null, { code: C.FAILD, msg: C.HALL_REDPACK_NOFOUND });
    }
    if (redpack.golds.length <= 0) {
        this.ovrp[msg.rid] = true;
        return next(null, { code: C.OK, gold: String(0) });
    }
    var player = yield this.app.models.Player.findByIdAsync(session.uid, 'name gold');
    if (!player) {
        return next(null, { code: C.FAILD, msg: C.PLAYER_NOT_FOUND });
    }
    var gold = redpack.golds.pop();
    if (gold > (redpack.maxVal || 0)) {
        redpack.maxName = player.name;
        redpack.maxVal = gold;
    }
    if (redpack.golds.length <= 0) {
        this.ovrp[msg.rid] = true;
        yield this.app.controllers.hall.broadcastAsync(null, util.format('5:%d:%d:%d:%s', -1, -1, redpack.maxVal, redpack.maxName));
    }
    player.gold += gold;
    yield redpack.saveAsync();
    return player.saveAsync()
        .then(() => ({ code: C.OK, gold: String(gold) }))
        .nodeify(next);
});

// 邀请信息
proto.spreadInfo = P.coroutine(function* (msg, session, next) {
    if (!session.uid) {
        return next(null, { code: C.ERROR, msg: C.PLAYER_NOT_LOGIN });
    }
    var player = yield this.app.models.Player.findByIdReadOnlyAsync(session.uid);
    if (!player) {
        return next(null, { code: C.FAILD, msg: C.PLAYER_NOT_FOUND });
    }
    var data = { backRmb: String(player.backRmb || 0) };
    var players = yield this.app.models.Player.findReadOnlyAsync({ spreader: player.account }, '_id');
    data.count = String(players.length);
    return next(null, { code: C.OK, data: data });
});

// 月卡商品
proto.getMonthCard = P.coroutine(function* (msg, session, next) {
    if (!session.uid) {
        return next(null, { code: C.ERROR, msg: C.PLAYER_NOT_LOGIN });
    }
    var cardsInfo = yield this.app.models.Monthcard.findByIdReadOnlyAsync(session.uid);
    var ownCards = (cardsInfo && cardsInfo.cards) || [];
    var cards = yield this.app.models.Shop.findReadOnlyAsync({ type: 2 });
    var list = [];
    for (let card of cards) {
        let item = {
            id: String(card._id),
            name: card.name,
            desc: card.desc,
            state: '0',
            rmb: String(card.rmb),
            gold: String(card.gold),
            rate: String(card.wate_rate),
            everyDay: String(card.everyday_gold)
        };
        let own = _.find(ownCards, { _id: card._id });
        if (own) {
            let now = new Date();
            let lastMs = own.expire_time - now.getTime();
            if (-1 == own.expire_time || lastMs > 0) {
                let lastGet = new Date(own.get_time);
                if (now.getDate() != lastGet.getDate() || now.getMonth() != lastGet.getMonth() || now.getFullYear() != lastGet.getFullYear()) {
                    item.state = '1';
                }
                else {
                    item.state = '2';
                }
                if (-1 == own.expire_time) {
                    item.lastDay = -1;
                }
                else {
                    item.lastDay = String(Math.ceil(lastMs / 86400000));
                }
                item.gold = String(own.getGold);
                item.everyDay = String(own.everyDay);
            }
        }
        list.push(item);
    }
    return next(null, { code: C.OK, list: list });
});

// 领取每日月卡
proto.getCardEveryDay = P.coroutine(function* (msg, session, next) {
    if (!session.uid) {
        return next(null, { code: C.ERROR, msg: C.PLAYER_NOT_LOGIN });
    }
    if (!msg.shopId) {
        return next(null, { code: C.FAILD, msg: C.HALL_PARAM_ERROR });
    }
    var player = yield this.app.models.Player.findByIdAsync(session.uid);
    if (!player) {
        return next(null, { code: C.FAILD, msg: C.PLAYER_NOT_FOUND });
    }
    var cardsInfo = yield this.app.models.Monthcard.findByIdAsync(session.uid);
    if (!cardsInfo) {
        return next(null, { code: C.FAILD, msg: C.HALL_CARD_NOT_BUY });
    }
    var ownCard = cardsInfo.cards.id(Number(msg.shopId));
    if (!ownCard) {
        return next(null, { code: C.FAILD, msg: C.HALL_CARD_NOT_BUY });
    }
    let now = new Date();
    let lastMs = ownCard.expire_time - now.getTime();
    if (-1 != ownCard.expire_time && lastMs < 0) {
        return next(null, { code: C.FAILD, msg: C.HALL_MONTHCARD_OVERDUE });
    }
    let lastGet = new Date(ownCard.get_time);
    if (now.getDate() == lastGet.getDate() && now.getMonth() == lastGet.getMonth() && now.getFullYear() == lastGet.getFullYear()) {
        return next(null, { code: C.FAILD, msg: C.HALL_CARD_SENCOND_GET });
    }
    ownCard.get_time = now.getTime();
    player.gold += ownCard.everyDay;
    yield cardsInfo.saveAsync();
    return player.saveAsync()
        .then(() => next(null, { code: C.OK, gold: String(player.gold) }));
});

// 领取救济金
proto.getAlms = P.coroutine(function* (msg, session, next) {
    if (!session.uid) {
        return next(null, { code: C.ERROR, msg: C.PLAYER_NOT_LOGIN });
    }
    return this.app.controllers.hall.getJiujijinAsync(session.uid).nodeify(next);
});

// 获取VIP信息
proto.getVips = P.coroutine(function* (msg, session, next) {
    if (!session.uid) {
        return next(null, { code: C.ERROR, msg: C.PLAYER_NOT_LOGIN });
    }
    return this.app.controllers.hall.getVipsAsync(session.uid).nodeify(next);
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

// 获取斗地主桌子
proto.queryDDZTable = P.coroutine(function* (msg, session, next) {
    if (!session.uid) {
        return next(null, { code: C.ERROR, msg: C.PLAYER_NOT_LOGIN });
    }
    var player = yield this.app.models.Player.findByIdReadOnlyAsync(session.uid, 'gameServerId gameId');
    if (!player) {
        return next(null, { code: C.FAILD, msg: C.PLAYER_NOT_FOUND });
    }
    if (player.gameServerId) {
        return next(null, { code: C.FAILD, msg: C.GAME_HAS_ALREADY });
    }
    return this.app.controllers.hall.queryDDZTableAsync(Number(msg.difen)).nodeify(next);
});

//获取抽奖界面信息
proto.getLotteryInfo = cor(function* (msg, session, next) {
    if (!session.uid) {
        return next(null, { code: C.ERROR, msg: C.PLAYER_NOT_LOGIN });
    }
    return this.app.controllers.hall.getDrawsAsync(session.uid).nodeify(next);
});

//抽奖
proto.getLottery = cor(function* (msg, session, next) {
    if (!session.uid) {
        return next(null, { code: C.ERROR, msg: C.PLAYER_NOT_LOGIN });
    }
    return this.app.controllers.hall.luckDrawAsync(session.uid, Number(msg.drawId)).nodeify(next);
})

//提交问题
proto.setProposal = cor(function* (msg, session, next) {
    if (!session.uid) {
        return next(null, { code: C.ERROR, msg: C.PLAYER_NOT_LOGIN });
    }
    return this.app.controllers.hall.setProposalAsync(session.uid, msg.proposal).nodeify(next);
});

//获取邮件列表
proto.getMails = cor(function* (msg, session, next) {
    if (!session.uid) {
        return next(null, { code: C.ERROR, msg: C.PLAYER_NOT_LOGIN });
    }
    return this.app.controllers.mailer.getMailsAsync(session.uid).nodeify(next);
});

//查看邮件内容
proto.checkMail = cor(function* (msg, session, next) {
    if (!session.uid) {
        return next(null, { code: C.ERROR, msg: C.PLAYER_NOT_LOGIN });
    }
    return this.app.controllers.mailer.lookMailAsync(session.uid, Number(mailid)).nodeify(next);
});

//获取转盘信息
proto.getDialInfo = cor(function* (msg, session, next) {
    if (!session.uid) {
        return next(null, { code: C.ERROR, msg: C.PLAYER_NOT_LOGIN });
    }
    return this.app.controllers.hall.getFortuneInfoAsync(session.uid).nodeify(next);
});

//转盘抽奖
proto.getDialAward = cor(function* (msg, session, next) {
    if (!session.uid) {
        return next(null, { code: C.ERROR, msg: C.PLAYER_NOT_LOGIN });
    }
    return this.app.controllers.hall.getFortuneAsync(session.uid).nodeify(next);
});

//获取竞猜列表
proto.getCompetitionList = cor(function* (msg, session, next) {
    if (!session.uid) {
        return next(null, { code: C.ERROR, msg: C.PLAYER_NOT_LOGIN });
    }
    return this.app.controllers.hall.getCompetitionListAsync(session.uid).nodeify(next);
});

//竞猜
proto.competition = cor(function* (msg, session, next) {
    if (!session.uid) {
        return next(null, { code: C.ERROR, msg: C.PLAYER_NOT_LOGIN });
    }
    return this.app.controllers.hall.competiAsync(session.uid, msg.competitionId, Number(msg.aorb), Number(msg.gold)).nodeify(next);
});

//获取竞猜记录
proto.getCompetitionRecordList = cor(function* (msg, session, next) {
    if (!session.uid) {
        return next(null, { code: C.ERROR, msg: C.PLAYER_NOT_LOGIN });
    }
    return this.app.controllers.hall.getCompetitionRecordListAsync(session.uid).nodeify(next);
});

//获取关注金币
proto.getFollowGold = cor(function* (msg, session, next) {
    if (!session.uid) {
        return next(null, { code: C.ERROR, msg: C.PLAYER_NOT_LOGIN });
    }
    return this.app.controllers.hall.getOnceGoldAsync(session.uid).nodeify(next);
});

//修改昵称  性别
proto.updateName = cor(function* (msg, session, next) {
    if (!session.uid) {
        return next(null, { code: C.ERROR, msg: C.PLAYER_NOT_LOGIN });
    }
    return this.app.controllers.hall.updateNameAsync(session.uid, msg.name, String(msg.sex || 1), msg.headurl).nodeify(next);
});

//修改地址
proto.updateAddress = cor(function* (msg, session, next) {
    if (!session.uid || !msg.address) {
        return next(null, { code: C.ERROR, msg: C.PLAYER_NOT_LOGIN });
    }
    return this.app.controllers.hall.updateAddressAsync(session.uid, String(msg.address)).nodeify(next);
});

//查询地址
proto.getAddress = cor(function* (msg, session, next) {
    if (!session.uid) {
        return next(null, { code: C.ERROR, msg: C.PLAYER_NOT_LOGIN });
    }
    return this.app.controllers.hall.getAddressAsync(session.uid).nodeify(next);
});

// 输赢榜
proto.getWinRank = cor(function* (msg, session, next) {
    if (!session.uid) {
        return next(null, { code: C.ERROR, msg: C.PLAYER_NOT_LOGIN });
    }
    var nowTime = Date.now();
    if (nowTime - this.rankTime > 900000) {
        let today = new Date(nowTime);
        today.setHours(0);
        today.setMinutes(0);
        today.setSeconds(0);
        today.setMilliseconds(0);
        this.winsRank = yield this.app.models.Player.aggregateAsync([
            { $project: { _id: 0, name: 1, sex: 1, headurl: 1, vip: 1, gold: { $subtract: ['$gold', '$todayGold'] }, lastLoginTime: 1 } },
            { $match: { lastLoginTime: { $gte: today.getTime() }, gold: { $gt: 0 } } },
            { $sort: { gold: -1 } },
            { $limit: 20 }
        ]);
        this.lostRank = yield this.app.models.Player.aggregateAsync([
            { $project: { _id: 0, name: 1, sex: 1, headurl: 1, vip: 1, gold: { $subtract: ['$gold', '$todayGold'] }, lastLoginTime: 1 } },
            { $match: { lastLoginTime: { $gte: today.getTime() }, gold: { $lt: 0 } } },
            { $sort: { gold: 1 } },
            { $limit: 20 }
        ]);
        if (this.winsRank.length > 0 || this.lostRank.length > 0) this.rankTime = nowTime;
    }
    return next(null, { code: C.OK, list: Number(msg.win) ? this.winsRank : this.lostRank });
});

