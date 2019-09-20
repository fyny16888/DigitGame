'use strict';

var quick = require('quick-pomelo');
var P = quick.Promise;
var _ = require('lodash');
var uuid = require('node-uuid');
var C = require('../../share/constant');
var logger = quick.logger.getLogger('hall', __filename);
//0 见面礼 1 胜利任务 2 玩游戏 3 游戏坐庄 4 充值任务 5 坐庄爆庄
var Const = require('../../share/const');
var wxpay = require('../../http/weixin/wxpay');
var TASK_TYPE = Const.TASK_TYPE;
var NOTICE_TYPE = Const.NOTICE_TYPE;

// 构造方法
var Controller = function (app) {
    this.app = app;
    this.dashangId = 'dashang';
    this.giftId = 'gift';
    this.vipId = 'vip';
    this.drawId = 'draw';
    this.fortuneId = 'fortune';
    this.jjg = 10000;
};

// 导出方法
module.exports = function (app) {
    return new Controller(app);
};

// 原型对象
var proto = Controller.prototype;

var cor = P.coroutine;

//发布打赏信息
proto.addRewardAsync = cor(function* (playerId) {
    // TODO 打赏次数暂定为一次
    var nowTime = Date.now();
    var player = yield this.app.models.Player.findByIdAsync(playerId, 'vip dsSign');
    if (!!player.dsSign == false) {
        player.dsSign = [0, nowTime].join('|');
    }
    var pd = player.dsSign.split('|');
    var hasSign = this.hasSign(nowTime, pd[1]);
    if (!hasSign) {
        pd[0] = 0;
        pd[1] = nowTime;
    }
    if (hasSign && Number(pd[0]) >= 1) {
        return { code: C.FAILD, msg: C.HALL_HAS_REWARD };
    }
    if (player.vip <= -1) {
        return { code: C.FAILD, msg: C.HALL_LOW_VIP };
    }
    var reward = yield this.app.models.Reward.findByIdAsync(this.dashangId);
    if (!reward) {
        reward = new this.app.models.Reward({ _id: this.dashangId });
    }
    if (reward.rewards.length >= 100) {
        return { code: C.FAILD, msg: C.HALL_REWARD_FULL };
    }
    var rew = reward.rewards.id(playerId);
    if (rew) {
        if (!hasSign) {
            var rew_index = _.findIndex(reward.rewards, function (n) { return n._id == playerId });
            reward.rewards.splice(rew_index, 1);
        } else {
            return { code: C.FAILD, msg: C.HALL_HAS_REWARD };
        }
    }
    reward.rewards.unshift({ _id: playerId, create_time: nowTime });
    player.dsSign = [Number((pd[0])) + 1, pd[1]].join('|');
    yield player.saveAsync();
    yield reward.saveAsync();
    return { code: C.OK };
});

//获取打赏信息
proto.getRewardListAsync = cor(function* (playerId) {
    var rew = yield this.app.models.Reward.findByIdAsync(this.dashangId);
    var data = [];
    if (rew) {
        var rewards = _.clone(rew.rewards);
        rewards = _.sortBy(rewards, function (n) { return -n.create_time });
        var rl = rewards.length;
        var nowTime = Date.now();
        for (let r = 0; r < rl; r++) {
            let reward = rewards[r];
            var subTime = parseInt((nowTime - reward.create_time) / 1000 / 60);
            if (subTime >= 30) {
                rew.rewards.splice(r, 1);
                continue;
            }
            var player = yield this.app.models.Player.findByIdReadOnlyAsync(reward._id);
            data.push({ id: reward._id, name: player.name, vip: player.vip, time: reward.create_time });
        }
        data.splice(20, rl);
        yield rew.saveAsync();
    }
    return { code: C.OK, data: data };
});

/**
 * @ playerId 玩家ID
 * @ dsId 打赏ID
 * @ dsGold 打赏金额
 */
proto.giveRewardAsync = cor(function* (playerId, dsId, dsGold) {
    if (playerId == dsId) {
        return { code: C.FAILD, msg: C.HALL_NO_REWARD_SELF };
    }
    var player = yield this.app.models.Player.findByIdAsync(playerId);
    var reward = yield this.app.models.Reward.findByIdAsync(this.dashangId);
    var rew_index = _.findIndex(reward.rewards, { _id: dsId });
    var dsje = [100000, 200000, 1000000, 2000000, 5000000, 10000000];
    if (rew_index == -1) {
        return { code: C.FAILD, msg: C.HALL_NO_THIS_REWARDS };
    };
    var d_i = _.findIndex(dsje, function (d) { return d == dsGold });
    if (d_i == -1) {
        return { code: C.FAILD, msg: C.HALL_WRONG_REARDS_GOLD };
    }
    //固定金额   打赏次数   
    var subTime = parseInt((Date.now() - reward.rewards[rew_index].create_time) / 1000 / 60);
    if (subTime >= 30) {
        reward.rewards.splice(rew_index, 1);
        yield reward.saveAsync();
        return { code: C.FAILD, msg: C.HALL_REWARD_EXPIRE };
    }
    if ((player.gold - dsGold) < 0) {
        return { code: C.FAILD, msg: C.HALL_NO_ENOUGH_MONEY };
    }
    player.gold -= dsGold;
    yield player.saveAsync();
    var rewPlayer = yield this.app.models.Player.findByIdAsync(dsId);
    rewPlayer.gold += dsGold;
    yield rewPlayer.saveAsync();
    reward.rewards.splice(rew_index, 1);
    yield reward.saveAsync();
    yield this.pushMsgAsync([dsId], 'notice_message', { type: NOTICE_TYPE.reward, gold: dsGold, name: player.name });
    return { code: C.OK, gold: player.gold };
});

proto.initTaskAsync = cor(function* (playerId) {
    var defaultTasks = [
        { _id: 1, type: 2, get_type: TASK_TYPE.seeueveryday, describe: '每日来玩就送金币', title: '每日见面礼', max: 1, status: 1, progress: 1, num: 10000 },
        { _id: 2, type: 2, get_type: TASK_TYPE.playgame, describe: '每日坚持玩游戏(玩金鲨银鲨，百人牛牛，金花为有效任务)', title: '每日玩任意游戏3局', max: 3, status: 0, progress: 0, num: 10000 },
        { _id: 3, type: 2, get_type: TASK_TYPE.win, describe: '每日任意游戏(玩金鲨银鲨，百人牛牛，金花为有效任务)第一次赢', title: '每日首胜奖励', max: 1, status: 0, progress: 0, num: 10000 },
        { _id: 4, type: 2, get_type: TASK_TYPE.dobanker, describe: '每日任意游戏坐庄10次', title: '庄家大礼包', max: 10, status: 0, progress: 0, num: 1000000 },
        { _id: 5, type: 2, get_type: TASK_TYPE.recharge, describe: '每日充值任意金额', title: '每日首充奖励', max: 1, status: 0, progress: 0, num: 1000000 },
        { _id: 6, type: 2, get_type: TASK_TYPE.bombbanker, describe: '每日被爆庄一次', title: '爆庄奖', max: 1, status: 0, progress: 0, num: 100000 }
    ];
    var task = new this.app.models.Task({ _id: playerId, tasks: defaultTasks });
    yield task.saveAsync();
    return task;
});

//获取任务列表
proto.getTaskListAsync = cor(function* (playerId) {
    var task = yield this.app.models.Task.findByIdAsync(playerId);
    if (!task) {
        //get_type 1 胜利任务 2 玩游戏 3 游戏坐庄 4 充值任务 5 坐庄爆庄
        task = yield this.initTaskAsync(playerId);
    }
    var getStrTime = function (timestamp) {
        var ti = new Date();
        ti.setTime(timestamp);
        return ti.toDateString();
    };
    var ra = [];
    //类型为2的任务为每日任务
    for (let t of task.tasks) {
        if (t && t.type == 2) {
            var nowTime = Date.now();
            if (nowTime > t.get_time) {
                var nt = getStrTime(nowTime);
                var tg = getStrTime(t.get_time);
                if (nt != tg) {
                    if (t.get_type == TASK_TYPE.seeueveryday) {
                        t.get_time = nowTime;
                        t.status = 1;
                    }
                    else {
                        t.status = 0;
                        t.progress = 0;
                    };
                }
            }
        }
        var pg = {};
        pg.desc = t.describe;
        pg.cur = t.progress;
        var g = _.clone(t._doc);
        for (var i in g) {
            if (i != 'describe' && i != 'get_time' && i != 'progress' && i != 'gift_type') {
                pg[i] = g[i];
            }
        }
        pg.withVip = 0;
        if (t.get_type == TASK_TYPE.recharge) {
            pg.withVip = 1;
        }
        ra.push(pg);
    }
    yield task.saveAsync();
    return { code: C.OK, data: ra };
});

//获取摇钱树信息
proto.getMoneyTreeAsync = cor(function* (playerId) {
    var mt = yield this.app.models.MoneyTree.findByIdReadOnlyAsync(playerId);
    if (!mt) {
        return { code: C.OK, data: { gold: 0, level: 0, max: 0 } };
        // return { code: C.OK, data: { gold: 3000, level: 2, max: 24000 } };
    }
    var nowTime = Date.now();
    var subHour = parseInt((nowTime - mt.get_time) / 1000 / 60 / 60);
    if (subHour > 8) subHour = 8;
    return { code: C.OK, data: { gold: subHour * mt.per_hour, level: mt.level, max: mt.per_hour * 8 } };
});

/**
 * 充值金额换算摇钱树等级
 * @ playerId 玩家ID
 * @ totalMoney 累计充值总金额
 */
proto.countMoneyTreeLevelAsync = cor(function* (playerId, totalMoney) {
    //测试6元为一等级 每级增加金币为100 一级产出金币10000
    var level = parseInt(totalMoney / 6);
    var mt = yield this.app.models.MoneyTree.findByIdAsync(playerId);
    if (!mt) {
        mt = new this.app.models.MoneyTree({ _id: playerId });
    }
    if (level > 999) level = 999;
    mt.level = level;
    mt.per_hour = 100 * (mt.level - 1) + 10000;
    yield mt.saveAsync();
    return level;
});

//获取奖品列表
proto.getGiftListAsync = cor(function* (playerId) {
    var gift = yield this.app.models.Gift.findByIdReadOnlyAsync(this.giftId);
    if (!gift) {
        return { code: C.OK, data: [] };
    }
    var returnData = _.clone(gift.gifts);
    returnData = _.map(returnData, function (n) { n.vip = n.rule; n.ticket = n.need_count; delete n.rule; delete n.need_count; return n; });
    return { code: C.OK, data: returnData };
});

//兑换奖品
proto.exchangeGiftAsync = cor(function* (playerId, giftId) {
    var player = yield this.app.models.Player.findByIdAsync(playerId, 'name vip gift gold');
    var gifts = yield this.app.models.Gift.findByIdAsync(this.giftId);
    var addressInfo = yield this.app.models.Address.findByIdReadOnlyAsync(playerId);
    var address = '';
    if (addressInfo) address = addressInfo.address;
    var selfDraw = yield this.app.models.Selfdraws.findByIdAsync(playerId);
    if (!selfDraw) {
        selfDraw = new this.app.models.Selfdraws({ _id: playerId });
        yield selfDraw.saveAsync();
    }
    var gift = gifts.gifts.id(giftId);
    if (!gift) {
        return { code: C.FAILD, msg: C.HALL_NO_GIFT };
    }
    if (player.vip < gift.rule) {
        return { code: C.FAILD, msg: C.HALL_LOW_VIP };
    }
    if (selfDraw.total_draw < gift.need_count) {
        return { code: C.FAILD, msg: C.HALL_NO_ENOUGH_NODE };
    }
    var nowTime = Date.now();
    player.gift.push({ _id: nowTime, giftId: giftId });
    var er = new this.app.models.Exchangerecord({ _id: uuid.v1(), name: player.name, exchange_time: nowTime, giftId: giftId, playerId: playerId, gift_name: gift.name, need_count: gift.need_count, address: address });
    if (gift.exchange_type == 1) {
        er.status = 2;
        player.gold += gift.count;
    } else {
        gift.count = gift.count || 0;
        gift.count -= 1;
        selfDraw.total_draw -= gift.need_count;
    }
    yield selfDraw.saveAsync();
    yield player.saveAsync();
    yield gifts.saveAsync();
    yield er.saveAsync();
    return { code: C.OK, data: { userticket: selfDraw.total_draw } };
});

//self兑换奖品列表
proto.exchangeListAsync = cor(function* (playerId) {
    var player = yield this.app.models.Player.findByIdReadOnlyAsync(playerId, 'gift');
    if (!player.gift || player.gift.length <= 0) {
        return { code: C.OK, data: [] };
    }
    var gifts = yield this.app.models.Gift.findByIdReadOnlyAsync(this.giftId, 'gifts');
    var returnData = [];
    for (var i = 0; i < player.gift.length; i++) {
        var gift = gifts.gifts.id(player.gift[i].giftId);
        returnData.push({ award: gift.name, time: player.gift[i]._id });
    }
    return { code: C.OK, data: returnData };
});

//兑换记录列表
proto.exchangeRecordAsync = cor(function* (playerId) {
    var Exchangerecord = yield this.app.models.Exchangerecord.findMongoAsync({}, 'giftId playerId exchange_time', { sort: '-exchange_time', limit: 50 });
    var gifts = yield this.app.models.Gift.findByIdReadOnlyAsync(this.giftId, 'gifts');
    var returnData = [];
    for (var i in Exchangerecord) {
        var gift = gifts.gifts.id(Exchangerecord[i].giftId);
        var player = yield this.app.models.Player.findByIdReadOnlyAsync(Exchangerecord[i].playerId, 'vip name');
        returnData.push({ award: gift.name, name: player.name, vip: player.vip, time: Exchangerecord[i].exchange_time });
    }
    return { code: C.OK, data: returnData };
})

//获取摇钱树上的金币
proto.getMoneyFromTreeAsync = cor(function* (playerId) {
    var mt = yield this.app.models.MoneyTree.findByIdAsync(playerId);
    if (!mt) {
        return { code: C.FAILD, msg: C.HALL_NO_MONEY_TREE };
    }
    var nowTime = Date.now();
    var subHour = parseInt((nowTime - mt.get_time) / 1000 / 60 / 60);
    if (subHour == 0) {
        return { code: C.FAILD, msg: C.HALL_NO_ENOUGH_MONEY };
    }
    if (subHour > 8) subHour = 8;
    var player = yield this.app.models.Player.findByIdAsync(playerId);
    player.gold += (subHour * mt.per_hour);
    mt.get_time = nowTime;
    yield mt.saveAsync();
    yield player.saveAsync();
    return { code: C.OK, gold: player.gold };
});

//领取任务奖励
proto.getTaskGiftAsync = cor(function* (playerId, taskId) {
    var tasks = yield this.app.models.Task.findByIdAsync(playerId);
    var task = tasks.tasks.id(taskId);
    if (!task) {
        return { code: C.FAILD, msg: C.HALL_NOT_FOUND };
    }
    if (task.status !== 1) {
        var s = C.HALL_NOT_COMPLETE;
        if (task.status == 2) s = C.HALL_HAS_GET;
        return {
            code: C.FAILD, msg: s
        }
    }
    task.status = 2;
    var player = yield this.app.models.Player.findByIdAsync(playerId);
    switch (task.gift_type) {
        case 0: {
            player.gold += (task.get_type == TASK_TYPE.recharge ? task.num * (1 + player.vip) : task.num);
            task.get_time = Date.now();
        } break;
        default: break;
    }
    yield tasks.saveAsync();
    yield player.saveAsync();
    return { code: C.OK };
});

// 大厅消息通知
proto.pushMsgAsync = P.coroutine(function* (playerIds, route, msg) {
    var app = this.app;
    var self = this;
    if (playerIds.length > 0) {
        return process.nextTick(function () {
            return app.memdb.goose.transactionAsync(cor(function* () {
                for (let p of playerIds) {
                    yield app.controllers.player.pushAsync(p, route, msg);
                }
            }), app.getServerId())
                .then(function () {
                    return app.event.emit('transactionSuccess');
                }, function () {
                    return app.event.emit('transactionFail');
                });
        });
    }
});

/**
 * 胜利任务状态更新
 * @ us 更新玩家数组  ID数组
 * @ gameId 游戏ID
 * @ taskType 任务类型
 */
proto.updateTaskStatusAsync = cor(function* (us, taskType, gameId) {
    var ids = [];
    for (var i in us) {
        var w = us[i];
        if (w) {
            var notice = yield this.updateTaskProgressAsync(w, taskType);
            if (notice) {
                ids.push(w);
            }
        }
    }
    if (ids.length > 0) {
        //消息通知类型  1任务
        return this.pushMsgAsync(ids, 'notice_message', { type: NOTICE_TYPE.task });
    } else {
        return true;
    }
});

/**
 * 更新任务进程和状态
 * @ playerId 玩家ID
 * @ type 更新任务类型
 */
proto.updateTaskProgressAsync = cor(function* (playerId, type) {
    var task = yield this.app.models.Task.findByIdAsync(playerId);
    var notice = false;
    if (task) {
        var tasks = task.tasks;
        var nowTime = Date.now();
        var wts = _.filter(tasks, { get_type: type });
        for (let t of wts) {
            if (t && t.type == 2) {
                if (nowTime > t.get_time) {
                    if (!this.hasSign(nowTime, t.get_time)) {
                        if (t.get_type == TASK_TYPE.seeueveryday) {
                            t.get_time = nowTime;
                            t.status = 1;
                        }
                        else {
                            t.status = 0;
                            t.progress = 0;
                        };
                    }
                }
            }
            if (t.status == 0) {
                t.progress += 1;
                //get_time 任务更新时间
                t.get_time = nowTime;
                if (t.get_type == TASK_TYPE.recharge) {
                    var player = yield this.app.models.Player.findByIdAsync(playerId, 'fortuneTimes');
                    player.fortuneTimes += 1;
                    if (player.fortuneTimes > 3) player.fortuneTimes = 3;
                    yield player.saveAsync();
                }
                if (t.progress >= t.max) {
                    t.progress = t.max;
                    t.status = 1;
                    notice = true;
                }
            }
        }
        yield task.saveAsync();
    }
    return notice;
});

//获取签到次数
proto.getSignCountAsync = cor(function* (playerId) {
    var player = yield this.app.models.Player.findByIdAsync(playerId);
    var weekCount = getWeekNumber();
    player.signCount = player.signCount || [0, weekCount, Date.now()].join('|');
    var rc = player.signCount.split('|');
    var wc = Number(rc[1]);
    var rc0 = Number(rc[0]);
    if (wc != weekCount) {
        rc0 = 0;
        player.signCount = [0, weekCount, Date.now()].join('|');
    }
    var hasSign = false;
    if (rc0 != 0 && this.hasSign(Date.now(), rc[2])) {
        hasSign = true;
    }
    yield player.saveAsync();
    return { code: C.OK, count: rc0, percent: (player.vip || 0) * 100, hasSign: hasSign };
});

// 获取当天周数
var getWeekNumber = function () {
    var isLeapYear = function (year) {
        return (year % 400 == 0) || (year % 4 == 0 && year % 100 != 0);
    };
    var getMonthDays = function (year, month) {
        return [31, null, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month] || (isLeapYear(year) ? 29 : 28);
    };
    var nowTime = new Date(), year = nowTime.getFullYear(), month = nowTime.getMonth(), days = nowTime.getDate();
    for (var i = 0; i < month; i++) {
        days += getMonthDays(year, i);
    }
    var yearFirstDay = new Date(year, 0, 1).getDay() || 7;
    var week = null;
    if (yearFirstDay == 7) {
        week = Math.ceil(days / yearFirstDay);
    } else {
        days -= (7 - yearFirstDay + 1);
        week = Math.ceil(days / 7) + 1;
    }
    return week;
};

proto.getWeekNumber = getWeekNumber;

//是否当天做同一个操作
proto.hasSign = function (nowTime, signTime) {
    var getStrTime = function (timestamp) {
        var ti = new Date();
        ti.setTime(timestamp);
        return ti.toDateString();
    };
    var nt = getStrTime(nowTime);
    var gt = getStrTime(Number(signTime));
    return nt == gt;
};

//签到
proto.signAsync = cor(function* (playerId) {
    var nowTime = Date.now();
    // TODO 签到奖励需要读取配置表文件
    var signConfig = [10000, 20000, 30000, 40000, 50000, 60000, 70000];
    var player = yield this.app.models.Player.findByIdAsync(playerId);
    var ps = player.signCount.split('|');
    if (this.hasSign(nowTime, ps[2]) && Number(ps[0]) != 0) {
        return { code: C.FAILD, msg: C.SIGN_HAS_GET };
    }
    var cw = Number(ps[0]) + 1;
    player.gold += (signConfig[ps[0]] * (1 + (player.vip || 0)));
    player.signCount = [cw, ps[1], nowTime].join('|');
    yield player.saveAsync();
    return { code: C.OK, gold: player.gold };
});

// 大厅喇叭广播
proto.broadcastAsync = cor(function* (playerId, msg,type) {
    var msg = { name: '', msg: msg };
    type = type || 'p';
    var gold = 0;
    if (playerId && type=='p') {
        let player = yield this.app.models.Player.findByIdAsync(playerId);
        if (player) {
            if (!player.vip || player.vip < 10) {
                return { code: C.FAILD, msg: C.HALL_LOW_VIP };
            }
            if (player.gold < 1000000) {
                return { code: C.FAILD, msg: C.HALL_UNENOUGH_MSG };
            }
            player.gold -= 1000000;
            gold = player.gold;
            msg.name = player.name;
            yield player.saveAsync();
        }
    }
    return this.app.controllers.push.broadcastAsync('globalChat', msg)
        .then(() => ({ code: C.OK, data: { gold: String(gold) } }));
});

/**
 * 充值后的修改操作
 * @ playerId 玩家ID
 * @ shop_good 购买商品
 */
proto.initRechargeAsync = cor(function* (playerId, shop_good) {
    var app = this.app;
    var player = yield app.models.Player.findByIdAsync(playerId);
    var sprmbs = { '600': 200, '1000': 200, '2000': 300, '5000': 700, '10000': 1200, '50000': 5000, '1200': 200 };
    if (player.spreader) {
        // 推荐人返现

        let spreader = yield app.models.Player.findOneAsync({ account: player.spreader }, 'account');
        if (spreader) {
            var sd = yield this.app.models.Selfdraws.findByIdAsync(playerId);
            if (!sd) {
                sd = new this.app.models.Selfdraws({ _id: playerId, total_draw: 0, draws: [] });
            }
            sd.total_draw += (sprmbs[String(shop_good.rmb)] * 5 || 0);
            yield sd.saveAsync();
            // spreader.backRmb += (sprmbs[String(shop_good.rmb)] || 0);
            // yield spreader.saveAsync();
        }
    }
    player.gold += (shop_good.gold + (player.totalMoney <= 0 ? 5000000 : 0));
    player.totalMoney = player.totalMoney || 0;
    player.totalMoney += (shop_good.rmb);
    if (shop_good.type == 3) {
        player.pk_ticket = player.pk_ticket || 0;
        player.pk_ticket += shop_good.num;
    }
    var gold = player.gold;
    yield player.saveAsync();
    var totalMoney = player.totalMoney / 100;
    yield this.updateTaskStatusAsync([playerId], TASK_TYPE.recharge);
    // 摇钱树等级修改
    var mtl = yield this.countMoneyTreeLevelAsync(playerId, totalMoney);
    // vip等级修改
    var vip = yield this.countVipLevelAsync(playerId, totalMoney);
    // 月卡充值 添加是否月卡增加判定
    var data = {};
    if (shop_good.type == 2) {
        var mc = yield this.addMonthCardAsync(player, shop_good);
        data = mc;
        if (gold == -1) {
            return false;
        }
    }
    data.type = shop_good.type; data.vip = vip;
    data.mt = mtl; data.gold = gold;
    // 其他修改
    return { code: C.OK, data: data };
});

/**
 * monthcard 添加月卡，每次购买延长过期时间，如果过期，过期时间为0
 * @ playerId 玩家ID
 */
proto.addMonthCardAsync = cor(function* (player, shop_good) {
    var mc = yield this.app.models.Monthcard.findByIdAsync(player._id);
    var nowTime = Date.now();
    if (!mc) {
        mc = new this.app.models.Monthcard({ _id: player._id });
    }
    var card = mc.cards.id(shop_good._id);
    var sc = shop_good.continue_time;
    if (card) {
        if (card.expire_time != -1) {
            if (card.expire_time < nowTime) {
                card.expire_time = (nowTime + sc);
            } else {
                card.expire_time += sc;
            }
        }
    } else {
        card = { _id: shop_good._id, expire_time: sc != -1 ? (nowTime + sc) : sc, everyDay: shop_good.everyday_gold, getGold: shop_good.gold };
        mc.cards.push(card);
    }
    var ld = -1; var state = 1;
    if (card.expire_time > -1) {
        ld = Math.ceil((card.expire_time - nowTime) / (60 * 60 * 1000 * 24));
    }
    if (player.wateInvalid != -1 && shop_good.wate_rate >= 0 && shop_good.wate_rate <= player.wateRate) {
        player.wateInvalid = card.expire_time;
        player.wateRate = shop_good.wate_rate;
        yield player.saveAsync();
    }
    yield mc.saveAsync();
    if (card.get_time && card.get_time > 0) {
        if (this.hasSign(nowTime, card.get_time)) {
            state = 2;
        }
    }
    return { state: state, lastDay: ld, everyDay: shop_good.everyday_gold, getGold: shop_good.gold };
});

/**
 * vip 等级修改
 * @ playerId 玩家ID
 * @ totalMoney 累计充值金额
 */
proto.countVipLevelAsync = cor(function* (playerId, totalMoney) {
    var player = yield this.app.models.Player.findByIdAsync(playerId, 'vip name');
    var Vip = yield this.app.models.Vip.findByIdAsync(this.vipId);
    if (!Vip) {
        Vip = new this.app.models.Vip({ _id: this.vipId });
        yield Vip.saveAsync();
    }
    var vips = Vip.vips; var countMoney = 0;
    var vip = 0;
    for (var i = 1; i < 16; i++) {
        var v = vips.id(i);
        if (v) {
            countMoney = v.money;
            if ((v.money / 100) > totalMoney) {
                vip = v._id - 1;
                break;
            }
            vip = v._id;
        }
    }
    if ((countMoney / 100) < totalMoney) vip = 15;
    if (player.vip != vip) {
        yield this.broadcastAsync(playerId, '7:' + player.name + ':' + vip,'s');
    }
    player.vip = vip;
    yield player.saveAsync();
    return player.vip;
});

/**
 * 领取救济金
 */
proto.getJiujijinAsync = cor(function* (playerId) {
    var player = yield this.app.models.Player.findByIdAsync(playerId);
    var nowTime = Date.now();
    player.jjGold = player.jjGold || [0, nowTime].join('|');
    var pj = player.jjGold.split('|');
    if (!this.hasSign(nowTime, pj[1])) {
        pj[0] = 0;
    }
    if (Number(pj[0]) >= 2) {
        return { code: C.FAILD, msg: C.HALL_HAS_GET_ALL };
    }
    var totalGold = player.bank + player.gold;
    if (totalGold < 10000) {
        var gold = (this.jjg * (player.vip + 1));
        pj[0] = Number(pj[0]) + 1;
        pj[1] = nowTime;
        player.jjGold = pj.join('|');
        player.gold += gold;
        yield player.saveAsync();
        return { code: C.OK, gold: player.gold };
    }
    return { code: C.FAILD, msg: C.HALL_NOT_GET_JJG };
});

/**
 * 获取VIP信息
 */
proto.getVipsAsync = cor(function* (playerId) {
    var player = yield this.app.models.Player.findByIdReadOnlyAsync(playerId, 'totalMoney vip');
    var rd = { totalMoney: player.totalMoney, vip: player.vip };
    var Vip = yield this.app.models.Vip.findByIdAsync(this.vipId);
    if (!Vip) {
        Vip = new this.app.models.Vip({ _id: this.vipId });
        yield Vip.saveAsync();
    }
    rd.vips = [];
    for (let v of Vip.vips) {
        if (v._id == (player.vip + 1)) {
            rd.needMoney = v.money;
        }
        rd.vips.push({ id: v._id, money: v.money, jjg: this.jjg * (1 + Number(v._id)), percent: v.gold_percent });
    }
    return { code: C.OK, data: rd };
});

/**
 * 获取斗地主桌子
 */
proto.queryDDZTableAsync = cor(function* (difen) {
    difen = Number(difen || 1);
    var difen_arr = [100, 50000, 1000000];
    var df_i = _.findIndex(difen_arr, function (n) { return n == difen; });
    if (df_i == -1) {
        return { code: C.FAILD, msg: C.TABLE_NOT_FOUND };
    }
    return P.promisify((cb) => {
        var lastData = { id: 0, count: 0 };
        var gameServers = this.app.getServersByType('ddz');
        var serverCount = 0;
        var ddzRemote = this.app.rpc.ddz.ddzRemote;
        return ddzRemote.queryTable.toServer('*', difen, (err, res) => {
            if (err || lastData.count >= 2) return;
            if (res.count > lastData.count) {
                lastData.id = res.id;
                lastData.count = res.count;
                if (lastData.count >= 2) {
                    return cb(null, {
                        code: C.OK,
                        tid: String(lastData.id)
                    });
                }
            }
            serverCount += 1;
            if (serverCount >= gameServers.length) {
                return cb(null, {
                    code: C.OK,
                    tid: String(lastData.id)
                });
            }
        });
    })();
});

/**
 * 获取十三水桌子
 */
proto.queryTWTableAsync = cor(function* (difen) {
    difen = Number(difen || 1);
    var difen_arr = [10000, 1000000, 10000000];
    var df_i = _.findIndex(difen_arr, function (n) { return n == difen; });
    if (df_i == -1) {
        return { code: C.FAILD, msg: C.TABLE_NOT_FOUND };
    }
    return P.promisify((cb) => {
        var lastData = { id: 0, count: 0 };
        var gameServers = this.app.getServersByType('tw');
        var serverCount = 0;
        var twRemote = this.app.rpc.tw.twRemote;
        return twRemote.queryTable.toServer('*', difen, (err, res) => {
            if (err || lastData.count >= 2) return;
            if (res.count > lastData.count) {
                lastData.id = res.id;
                lastData.count = res.count;
                if (lastData.count >= 2) {
                    return cb(null, {
                        code: C.OK,
                        tid: String(lastData.id)
                    });
                }
            }
            serverCount += 1;
            if (serverCount >= gameServers.length) {
                return cb(null, {
                    code: C.OK,
                    tid: String(lastData.id)
                });
            }
        });
    })();
});

/**
 * 抽奖界面信息
 */
proto.getDrawsAsync = cor(function* (playerId) {
    var luckdraw = yield this.app.models.Luckdraw.findByIdAsync(this.drawId);
    var nowTime = Date.now();
    if (!luckdraw) {
        luckdraw = new this.app.models.Luckdraw({
            _id: this.drawId
            , max_tickets: 500000
            , end_time: (nowTime + 60 * 60 * 60 * 1000)
            , has_get_tickets: 0
            , draws: [
                {
                    _id: 1, get_times: 12
                    , max_tickets: 200000
                    , single_ticket: 10,
                    cost_gold: 20000000,
                    draw_rate: 30
                },
                {
                    _id: 2, get_times: 12
                    , max_tickets: 200000
                    , single_ticket: 10,
                    cost_gold: 12000000,
                    draw_rate: 30
                },
                {
                    _id: 3, get_times: 12
                    , max_tickets: 200000
                    , single_ticket: 10,
                    cost_gold: 15000000,
                    draw_rate: 30
                },
                {
                    _id: 4, get_times: 12
                    , max_tickets: 200000
                    , single_ticket: 10,
                    cost_gold: 50000000,
                    draw_rate: 30
                },
                {
                    _id: 5, get_times: 12
                    , max_tickets: 200000
                    , single_ticket: 10,
                    cost_gold: 30000000,
                    draw_rate: 30
                },
                {
                    _id: 6, get_times: 12
                    , max_tickets: 200000
                    , single_ticket: 10,
                    cost_gold: 10000000,
                    draw_rate: 30
                }
            ]
        });
        yield luckdraw.saveAsync();
    }
    var selfDraw = yield this.app.models.Selfdraws.findByIdAsync(playerId);
    if (!selfDraw) {
        selfDraw = new this.app.models.Selfdraws({ _id: playerId });
        yield selfDraw.saveAsync();
    }
    return {
        code: C.OK, data: {
            awardArr: _.map(luckdraw.draws, function (n) { return { gold: n.cost_gold, _id: n._id } }), shopticket: (luckdraw.max_tickets - luckdraw.has_get_tickets)
            , userticket: selfDraw.total_draw
        }
    };
});

/**
 * 抽奖券
 */
proto.luckDrawAsync = cor(function* (playerId, drawId) {
    var luckdraw = yield this.app.models.Luckdraw.findByIdAsync(this.drawId);
    if (!luckdraw || (luckdraw && luckdraw.draws.length <= 0)) {
        return { code: C.FAILD, msg: C.HALL_NO_DRAW };
    }
    var draw = luckdraw.draws.id(drawId);
    if (!draw) {
        return { code: C.FAILD, msg: C.HALL_NO_DRAW };
    }
    // draw.has_use_tickets < draw.max_tickets &&  暂时去掉单个抽奖活动的限制
    if (luckdraw.has_get_tickets < luckdraw.max_tickets) {
        var nowTime = Date.now();
        if (nowTime > luckdraw.end_time || nowTime < luckdraw.begin_time) {
            return { code: C.FAILD, msg: C.HALL_NOT_TIME };
        }
        var player = yield this.app.models.Player.findByIdAsync(playerId);
        if (player.gold < draw.cost_gold) {
            return { code: C.FAILD, msg: C.HALL_NO_GOLD };
        }
        //单人抽奖处理
        var selfDraw = yield this.app.models.Selfdraws.findByIdAsync(playerId);
        if (!selfDraw) {
            selfDraw = new this.app.models.Selfdraws({
                _id: playerId, draws: [{
                    _id: drawId, get_time: nowTime
                    , get_times: draw.get_times
                }]
            });
            yield selfDraw.saveAsync();
        }
        var sd = selfDraw.draws.id(drawId);
        if (!sd) {
            selfDraw.draws.push({
                _id: drawId, get_time: nowTime
                , get_times: draw.get_times
            });
            yield selfDraw.saveAsync();
        }
        sd = _.find(selfDraw.draws, { _id: drawId });
        if (sd.get_time < luckdraw.begin_time) {
            sd.get_times = draw.get_times;
            sd.has_times = 0; sd.get_draws = 0;
        }
        // 更新抽奖进行中的抽奖次数
        if (sd.get_times != draw.get_times) {
            sd.get_times = draw.get_times;
        }
        //抽取次数已达上限
        if (sd.has_times >= sd.get_times) {
            return { code: C.FAILD, msg: C.HALL_NO_TIMES };
        }
        //扣除金币消耗
        player.gold -= draw.cost_gold;
        yield player.saveAsync();
        sd.get_time = nowTime;
        sd.has_times += 1;
        //是否中奖
        var hasIn = _.random(0, 100);
        var hi = 0;
        //该玩法当前已用点券小于最大时才能中奖 draw.has_use_tickets < draw.max_tickets && 
        if (hasIn < draw.draw_rate) {
            //中奖后随机奖券数量
            var getD = _.random(draw.min_single_ticket || 1, draw.single_ticket);
            // 不检测单个抽奖活动的奖券限制
            // if ((draw.has_use_tickets + getD) > draw.max_tickets) {
            //     getD = draw.max_tickets - draw.has_use_tickets;
            // }
            if ((luckdraw.has_get_tickets + getD) > luckdraw.max_tickets) {
                // getD = _.min([draw.max_tickets - draw.has_use_tickets, luckdraw.max_tickets - luckdraw.has_get_tickets]);
                // 暂时修改  看情况去掉
                getD = luckdraw.max_tickets - luckdraw.has_get_tickets;
            }
            hi = getD;
            var dr = new this.app.models.DrawRecord({
                _id: uuid.v1(),
                count: getD,
                draw_before: sd.get_draws,
                drawId: drawId,
                draw_after: sd.get_draws + getD,
                playerId: playerId
            });
            sd.get_draws += getD;
            selfDraw.total_draw += getD;
            draw.has_use_tickets += getD;
            luckdraw.has_get_tickets += getD;
            yield dr.saveAsync();
            yield luckdraw.saveAsync();
        }
        yield selfDraw.saveAsync();
        //返回奖券数量 0未中奖 >0中奖
        return { code: C.OK, data: { count: hi, userticket: selfDraw.total_draw, shopticket: (luckdraw.max_tickets - luckdraw.has_get_tickets), gold: player.gold } };
    }
    else return { code: C.FAILD, msg: C.HALL_NO_TICKETS };
});

proto.setProposalAsync = cor(function* (playerId, msg) {
    var nowTime = Date.now();
    var sp = yield this.app.models.Proposal.findByIdAsync(playerId);
    var player = yield this.app.models.Player.findByIdReadOnlyAsync(playerId, 'name');
    if (!sp) {
        sp = new this.app.models.Proposal({ _id: playerId, time: nowTime, times: 1 });
        var sps = new this.app.models.Proposals({ _id: uuid.v4(), playerId: playerId, time: nowTime, name: player.name, text: msg });
        yield sps.saveAsync();
        yield sp.saveAsync();
        return { code: C.OK };
    }
    if (!this.hasSign(nowTime, sp.time)) {
        sp.times = 0;
    }
    if (sp.times >= 3) {
        return { code: C.FAILD, msg: C.HALL_NO_PROPOSAL_TIMES };
    }
    var spr = new this.app.models.Proposals({ _id: uuid.v4(), playerId: playerId, time: nowTime, name: player.name, text: msg });
    yield spr.saveAsync();
    sp.times += 1;
    sp.time = nowTime;
    yield sp.saveAsync();
    return { code: C.OK };
});

// 红包算法
proto.shuffle = function (total, count) {
    var array = [];
    var _total = total;
    for (let i = 0; i < count; ++i) {
        let last = count - i;
        if (last <= 1) {
            array.push(_total);
        }
        else {
            let t = _.random(1, _total - last + 1);
            array.push(t);
            _total -= t;
        }
    }
    return _.shuffle(array);
};

// 后台发红包
proto.webAddPackAsync = cor(function* (redpack) {
    var total = redpack.total;
    var count = redpack.count;
    var redpack = new this.app.models.RedPack({ _id: uuid.v1() });
    redpack.uid = '0';
    redpack.gid = 100;
    redpack.total = total;
    redpack.count = count;
    redpack.golds = this.shuffle(total, count);
    yield redpack.saveAsync();
    process.nextTick(() => {
        var push = this.app.controllers.push;
        return push.broadcastAsync('redpack', { rid: redpack._id, name: '系统', total: String(redpack.total) });
    });
    return { code: C.OK };
});

// 设置抽奖
proto.setAwardsConfigAsync = cor(function* (config) {
    var luckdraw = yield this.app.models.Luckdraw.findByIdAsync(this.drawId);
    if (config.begin_time) {
        luckdraw.begin_time = Number(config.begin_time * 1000);
        luckdraw.end_time = Number(config.end_time * 1000);
        luckdraw.max_tickets = config.total_tickets || luckdraw.max_tickets;
    }
    if (config.max_tickets && config.id) {
        var targetAwards = luckdraw.draws.id(config.id);
        if (targetAwards) {
            targetAwards.max_tickets = config.max_tickets || targetAwards.max_tickets;
            targetAwards.get_times = config.get_times || targetAwards.get_times;
            targetAwards.cost_gold = config.cost_gold || targetAwards.cost_gold;
            targetAwards.draw_rate = config.draw_rate || targetAwards.draw_rate;
            targetAwards.single_ticket = config.single_ticket || targetAwards.single_ticket;
            targetAwards.min_single_ticket = config.min_single_ticket || targetAwards.min_single_ticket;
        }
    }
    yield luckdraw.saveAsync();
    return { code: C.OK };

});

// 采用建议
proto.getBugAsync = cor(function* (bugid) {
    var sp = yield this.app.models.Proposals.findByIdAsync(bugid);
    if (sp && sp.state == 0) {
        sp.state += 1;
        yield sp.saveAsync();
        let player = yield this.app.models.Player.findByIdAsync(sp.playerId, 'gold');
        if (player) {
            player.gold += 500000;
            yield player.saveAsync();
        }
        return this.app.controllers.mailer.createMailAsync(sp.playerId, '您的建议已被采纳，已发放50万金币到您的账号，请查收！', '', '系统');
    } else {
        return { code: C.FAILD };
    }
});

// 大转盘内容获取
proto.getFortuneInfoAsync = cor(function* (playerId) {
    var fortune = yield this.app.models.SingleData.findByIdAsync(this.fortuneId);
    // type 1 点券  2  红包   3   金币
    var defaultFortune = [
        { id: 1, num: 1, name: '1点券', type: 1, rate: 50 }, { id: 2, num: 1, name: '1元红包', type: 2, rate: 50 }, { id: 3, num: 2, name: '2点券', type: 1, rate: 30 }, { id: 4, num: 2, name: '2元红包', type: 2, rate: 30 }, { id: 5, num: 3, name: '3点券', type: 1, rate: 20 }, { id: 6, num: 3, name: '3元红包', type: 2, rate: 20 },
        { id: 7, num: 5, name: '5点券', type: 1, rate: 10 }, { id: 8, num: 5, name: '5元红包', type: 2, rate: 10 }, { id: 9, num: 10, name: '10点券', type: 1, rate: 5 }, { id: 10, num: 10, name: '10元红包', type: 2, rate: 0 }, { id: 11, num: 5000000, name: '5百万金币', type: 3, rate: 575 }, { id: 12, num: 10000000, name: '1千万金币', type: 3, rate: 200 }
    ];
    if (!fortune) {
        fortune = new this.app.models.SingleData({ _id: this.fortuneId, data: defaultFortune });
        fortune.markModified('data');
        yield fortune.saveAsync();
    }
    var ft = _.clone(fortune.data);
    ft = _.map(ft, function (n) {
        n.rate = -1;
        return n;
    });
    var player = yield this.app.models.Player.findByIdReadOnlyAsync(playerId, 'fortuneTimes');
    return { code: C.OK, list: ft, times: player.fortuneTimes };
});

var sendMoneyAsync = P.promisify(function (openId, money, cb) {
    var orderId = uuid.v1().replace(/-/g, '');
    return wxpay.pay(orderId, openId, money, '转盘抽奖', (err, res) => {
        if (err) return cb(null, { code: -1, orderId: orderId, msg: 'system error!' });
        var xml = res.xml;
        if (xml.return_code.text() != 'SUCCESS') {
            return cb(null, { code: -1, orderId: orderId, msg: xml.return_msg.text() });
        }
        if (xml.result_code.text() != 'SUCCESS') {
            return cb(null, { code: -1, orderId: orderId, msg: xml.err_code_des.text() });
        }
        return cb(null, { code: 0, orderId: xml.partner_trade_no.text() });
    });
});

// 大转盘抽奖
proto.getFortuneAsync = cor(function* (playerId) {
    var player = yield this.app.models.Player.findByIdAsync(playerId, 'gold fortuneTimes');
    if (typeof player.fortuneTimes == 'undefined' || player.fortuneTimes == -1) {
        return { code: C.FAILD, msg: C.HALL_NO_RECHARGE };
    }
    if (player.fortuneTimes <= 0) {
        return { code: C.FAILD, msg: C.HALL_HAS_FORTUNE };
    }
    var fortune = yield this.app.models.SingleData.findByIdReadOnlyAsync(this.fortuneId);
    if (fortune) {
        var allR = _.sumBy(fortune.data, function (n) { return Number(n.rate) });
        var randomNum = _.random(1, allR);
        var binggo = 0; var binggoId = -1; var binggotype = -1; var binggoname = '';
        var binggonum = -1;
        for (var i = 0; i < fortune.data.length; i++) {
            binggo += fortune.data[i].rate;
            if (binggo >= randomNum) {
                binggoId = fortune.data[i].id;
                binggotype = fortune.data[i].type;
                binggonum = fortune.data[i].num;
                binggoname = fortune.data[i].name;
                break;
            }
        }
        if (binggoId == -1) {
            return { code: C.FAILD };
        }
        player.fortuneTimes -= 1;
        var msg = '奖励发放成功';
        switch (binggotype) {
            case 1: {
                var selfDraw = yield this.app.models.Selfdraws.findByIdAsync(playerId);
                if (!selfDraw) {
                    selfDraw = new this.app.models.Selfdraws({ _id: playerId });
                }
                selfDraw.total_draw += binggonum;
                yield selfDraw.saveAsync();
            } break;
            case 2: {
                // if (playerId != 'o7stWwvZkjGYILBf2sv7xR3-JkwA@my2016') {
                //     console.warn('Not in whitelist :', playerId);
                //     break;
                // }
                var openId = playerId;
                var pos = playerId.lastIndexOf('@');
                if (pos != -1) {
                    openId = playerId.substr(0, pos);
                }
                var sma = yield sendMoneyAsync(openId, binggonum * 100);
                if (sma.code == -1) msg = '奖励发放失败';
                var mrp = new this.app.models.MoneyRedPackRecord({
                    _id: sma.orderId,
                    desc: sma.msg || '',
                    playerId: playerId,
                    status: sma.code
                });
                yield mrp.saveAsync();
            } break;
            case 3: {
                player.gold += binggonum;
            } break;
            default: break;
        }
        var DialRecord = new this.app.models.DialRecord({
            _id: uuid.v1(),
            playerId: playerId,
            type: binggotype,
            num: binggonum,
            name: binggoname
        });
        yield DialRecord.saveAsync();
        yield player.saveAsync();
        return { code: C.OK, binggo: binggoId, msg: msg };
    }
    return { code: C.FAILD, msg: C.FORTUNE_NOT_FOUND };
});

// 获取竞猜列表和个人开奖
proto.getCompetitionListAsync = cor(function* (playerId) {
    var selfCompetition = yield this.app.models.Selfcompetition.findByIdAsync(playerId);
    var returnData = { competitionlist: [] };
    var nowTime = Date.now();
    var add_gold = 0;
    returnData.selfData = [];
    if (selfCompetition) {
        for (var i = 0; i < selfCompetition.bet_arr.length; i++) {
            var selfAnswer = selfCompetition.bet_arr[i].answer;
            var competitionRecord = yield this.app.models.CompetitionListRecord.findByIdAsync(selfCompetition.bet_arr[i]._id);
            if (competitionRecord) {
                let rate = competitionRecord.rate;
                let result = competitionRecord.result;
                let self_bet_gold = selfCompetition.bet_arr[i].bet_gold;
                let win = 0;
                selfCompetition.bet_arr[i].r_w = -1;
                var answer = competitionRecord.answer.id(result);
                if (selfAnswer == result) {
                    add_gold += (self_bet_gold * answer.rate);
                    win = self_bet_gold * answer.rate;
                    selfCompetition.bet_arr[i].r_w = 1;
                }
                returnData.selfData.push({ self_win: win, url: competitionRecord.image_url, max_name: answer.max_name, max_win: answer.max_bet * answer.rate });
            }
        }
        let scr = new this.app.models.SelfcompetitionRecord({ _id: uuid.v1(), playerId: playerId, bet_arr: selfCompetition.bet_arr });
        yield scr.saveAsync();
        yield selfCompetition.removeAsync();
    }
    if (add_gold > 0) {
        let player = yield this.app.models.Player.findByIdAsync(playerId, 'gold wateRate wateInvalid');
        var wateRate = player.wateRate;
        var wateInvalid = player.wateInvalid; var pwr = competitionRecord.wate_rate || 0.05;
        if ((wateInvalid > Date.now() || wateInvalid == -1) && wateRate >= 0 && wateRate < pwr) {
            pwr = wateRate;
        }
        player.gold += (add_gold * (1 - pwr));
        yield player.saveAsync();
    }
    var competitionList = yield this.app.models.CompetitionList.findMongoAsync({ begin_time: { $lte: nowTime }, end_time: { $gt: nowTime } }, 'image_url answer title rate', { limit: 10 });
    if (competitionList.length > 0) {
        competitionList = _.map(competitionList, function (n) {
            n.answer = _.map(n.answer,
                function (m) { delete m.max_playerId; return m; });
            return n;
        });
        returnData.competitionlist = competitionList;
    }
    return { code: C.OK, data: returnData };
});

//竞猜记录
proto.getCompetitionRecordListAsync = cor(function* (playerId) {
    var competitionList = yield this.app.models.CompetitionListRecord.findMongoAsync({}, 'image_url result answer title rate', { limit: 20, sort: '-end_time' });
    if (competitionList.length > 0) {
        competitionList = _.map(competitionList, function (n) {
            n.answer = _.map(n.answer,
                function (m) { delete m.max_playerId; return m; });
            return n;
        });
    }
    return { code: C.OK, data: competitionList };
});

// 竞猜
proto.competiAsync = cor(function* (playerId, competitionId, aorb, gold) {
    if (isNaN(gold)) {
        return { code: C.FAILD, msg: C.ILLEGAL };
    }
    let compe = yield this.app.models.CompetitionList.findByIdAsync(competitionId);
    let nowTime = Date.now();
    // let gold_arr = [10000, 500000, 1000000, 10000000, 100000000, 1000000000];
    // let gi = _.indexOf(gold_arr, gold);
    // if (gi != -1) {

    // }
    if (compe) {
        if (compe.begin_time > nowTime) {
            return { code: C.FAILD, msg: C.COMPE_NOT_BEGIN };
        }
        if (compe.end_time < nowTime) {
            return { code: C.FAILD, msg: C.COMPE_HAS_END };
        }

        let sfc = yield this.app.models.Selfcompetition.findByIdAsync(playerId);

        if (!sfc) {
            sfc = new this.app.models.Selfcompetition({
                _id: playerId,
                bet_arr: []
            });
        } else {
            let sba = sfc.bet_arr.id(competitionId);
            if (sba) {
                return { code: C.FAILD, msg: C.COMPE_HAS_BET };
            }
        }
        let player = yield this.app.models.Player.findByIdAsync(playerId, 'name gold');
        if (player.gold < gold) {
            return { code: C.FAILD, msg: C.COMPE_NO_GOLD };
        }
        sfc.bet_arr.push({
            _id: competitionId,
            bet_gold: gold,
            answer: aorb
        });
        let compe_aw = compe.answer.id(aorb);
        compe_aw.total_bet = compe_aw.total_bet || 0;
        compe_aw.total_bet += gold;
        compe_aw.total_count = compe_aw.total_count || 0;
        compe_aw.total_count += 1;
        if (gold > compe_aw.max_bet) {
            compe_aw.max_playerId = playerId;
            compe_aw.max_name = player.name;
            compe_aw.max_bet = gold;
        }
        player.gold -= gold;
        yield player.saveAsync();
        yield sfc.saveAsync();
        yield compe.saveAsync();
        return { code: C.OK, data: { max_name: compe_aw.max_name, max_bet: compe_aw.max_bet } };
    }
    return { code: C.FAILD, msg: C.COMPE_ERR };
});

proto.getOnceGoldAsync = cor(function* (playerId) {
    var player = yield this.app.models.Player.findByIdAsync(playerId, 'gold follow');
    player.follow = player.follow || 0;
    if (player.follow > 0) {
        return { code: C.FAILD, msg: C.HALL_HAS_GET_GOLD };
    }
    player.gold += 500000;
    player.follow += 1;
    yield player.saveAsync();
    return { code: C.OK, gold: player.gold };
});

proto.updateNameAsync = cor(function* (playerId, name, sex, headurl) {
    let player = yield this.app.models.Player.findByIdAsync(playerId, 'name sex updatename headurl');
    if (player) {
        player.updatename = player.updatename || 1;
        if (player.updatename <= 0) {
            return { code: C.FAILD, msg: C.PLAYER_HAS_CHANGENAME };
        }
        player.name = name || player.name;
        player.sex = sex || player.sex;
        player.headurl = headurl || player.headurl;
        player.updatename = -1;
        yield player.saveAsync();
        return { code: C.OK, name: name, sex: sex };
    }
});

proto.updateAddressAsync = cor(function* (playerId, address) {
    let addressInfo = yield this.app.models.Address.findByIdAsync(playerId);
    if (!addressInfo) {
        addressInfo = new this.app.models.Address({ _id: playerId, address: address });
        yield addressInfo.saveAsync();
        return { code: C.OK };
    } else {
        addressInfo.address = address;
        yield addressInfo.saveAsync();
        return { code: C.OK };
    }
});

proto.getAddressAsync = cor(function* (playerId) {
    let address = yield this.app.models.Address.findByIdReadOnlyAsync(playerId);
    if (address) {
        return { code: C.OK, address: address.address };
    }
    return { code: C.OK, address: '' };
});