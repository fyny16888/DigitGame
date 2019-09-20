'use strict';

var quick = require('quick-pomelo');
var P = quick.Promise;
var cor = P.coroutine;
var _ = require('lodash');
var Logic = require('./logic');
var User = require('./user');
var uuid = require('node-uuid');
var C = require('../../share/constant');
var logger = quick.logger.getLogger('table', __filename);
var TableConfig = require('../../share/config/ddz_config.json');

// 桌子状态
var STATE = { FREE: 1, CALLING: 2, PLAYING: 3 };

// 构造方法
var Table = function (game, id, ownerId) {
    this.game = game;
    this.id = id;
    this.jushu = 0;
    this.cur_time = 0;
    // 人数
    this.count = 3;
    this.difen = 1;
    // 桌主
    this.ownerId = ownerId;

    //初始化内容
    this.state = STATE.FREE;
    this.users = Array(this.count);
    this.handCards = Array(this.count);
    //底牌
    this.lastCards = [];
    //地主index
    this.dizhu = -1;
    this.bom_count = 0;
    this.chuntian = 0;
    this.fan_chuntian = 0;
    //出牌记录
    this.record = [];
    //得胜者
    this.winner = -1;
    //倍数
    this.bet = 1;
    //当前出牌椅子ID
    this.chairId = -1;
};

// 导出状态
Table.STATE = STATE;

// 导出类
module.exports = Table;

// 原型对象
var proto = Table.prototype;

// 是否坐满
proto.isFull = function () {
    for (let user of this.users) {
        if (!user) {
            return false;
        }
    }
    return true;
};

// 是否坐满并准备
proto.isFullReady = function () {
    for (let user of this.users) {
        if (!user || (user && !user.isReady())) {
            return false;
        }
    }
    return true;
};

// 是否够人
proto.isEnough = function () {
    var count = 0;
    for (let user of this.users) {
        if (user) {
            count += 1;
            if (count > 1) {
                return true;
            }
        }
    }
    return false;
};

// 获取人数
proto.getCount = function () {
    var count = 0;
    for (let user of this.users) {
        if (user) count += 1;
    }
    return count;
};

// 是否准备
proto.isReady = function () {
    for (let user of this.users) {
        if (user) {
            if (!user.isOwner() && !user.isReady()) {
                return false;
            }
        }
    }
    return true;
};

// 是否游戏中
proto.isPlaying = function () {
    return this.state > STATE.FREE;
};

// 重置状态
proto.resetStatus = function () {
    for (let user of this.users) {
        if (user && user.isPlaying()) {
            user.state = User.STATE.FREE;
        }
    }
    this.state = STATE.FREE;
};

// 发送消息
proto.pushMsgAsync = cor(function* (index, route, msg) {
    var playerIds = [];
    if (index < 0 || index >= this.users.length) {
        for (let user of this.users) {
            if (user) {
                playerIds.push(user.id);
            }
        }
    }
    else {
        let user = this.users[index];
        if (user) {
            playerIds.push(user.id);
        }
    }
    if (playerIds.length > 0) {
        let app = this.game.app;
        let gameId = this.id;
        let doPush = () => {
            var channelId = 'ddz:t:' + gameId;
            return app.controllers.push.pushAsync(channelId, playerIds, route, msg)
                .catch((err) => {
                    logger.debug('pushMsgAsync: [%s]', err.message);
                });
        };
        return process.nextTick(() => {
            return P.bind(this)
                .then(() => doPush())
                .then(() => app.event.emit('transactionSuccess'), () => app.event.emit('transactionFail'));
        });
    }
});

// 加入桌子之后
proto.afterJoinAsync = cor(function* (user) {
    let player = yield this.game.app.models.Player.findByIdReadOnlyAsync(user.id, 'name sex headurl score gold');
    if (player) {
        yield this.pushMsgAsync(-1, 'join', { name: player.name, sex: player.sex, headurl: player.headurl, chairId: String(user.chairId), jifen: player.score, gold: String(player.gold) });
    }
    if (this.isFullReady()) {
        yield this.startGameAsync();
    }
    return true;
});

// 离开桌子之前
proto.beforeLeaveAsync = cor(function* (user) {
    var channelId = 'ddz:t:' + this.id;
    return this.game.app.controllers.push.quitAsync(channelId, user.id);
});

// 离开桌子之后
proto.afterLeaveAsync = cor(function* (user) {
    // 离开通知
    yield this.pushMsgAsync(-1, 'leave', { chairId: user.chairId });
    // 桌主离开
    if (user.id == this.ownerId) {
        let index = _.findIndex(this.users, function (user) {
            return user;
        });
        if (-1 != index) {
            // 转让桌主
            let user = this.users[index];
            this.ownerId = user.id;
            yield this.pushMsgAsync(index, 'changeOwner', { chairId: user.chairId });
        }
        else {
            return this.game.deleteTable(this.id);
        }
    }
    if (this.isPlaying()) {
        var bet = this.bet; var chuntian = this.chuntian; var fan_chuntian = this.fan_chuntian;
        var cc = [];
        var before_jiesuan = []; var record_result = []; var record_arr = [];
        for (var i = 0; i < this.users.length; i++) {
            let u = this.users[i]; let id;
            if (u) {
                id = u.id;
                cc[i] = this.difen * bet / 2;
                u.initContent();
            } else {
                id = user.id;
                cc[i] = -this.difen * bet;
            }
            let pl = yield this.game.app.models.Player.findByIdAsync(id);
            before_jiesuan.push({ _id: id, score: pl.gold });
            record_arr.push({ _id: id, score: cc[i] });
            pl.gold += cc[i];
            record_result.push({ _id: id, score: pl.gold });
            yield pl.saveAsync();
        }
        let b = { difen: this.difen, bet: this.bet };
        let return_obj = { data: cc, bet: b, bom: this.bom_count, chuntian: this.chuntian, fanchuntian: this.fan_chuntian };
        this.initContent();
        this.resetStatus();
        var record = new this.game.app.models.DDZRecord({ _id: uuid.v1(), start_time: this.cur_time, table_id: this.id, before_jiesuan: before_jiesuan, table_jushu: this.jushu, jiesuan: record_arr, result: record_result });
        yield record.saveAsync();
        return this.pushMsgAsync(-1, 'complete', return_obj);
    }
});

// 加入桌子
proto.joinAsync = cor(function* (user) {
    var data = [];
    var joined = false;
    var users = this.users; var gold = 0;
    for (let i = 0; i < users.length; ++i) {
        if (!users[i] && !joined) {
            let player = yield this.game.app.models.Player.findByIdReadOnlyAsync(user.id, 'connectorId gold');
            let connectorId = (player && player.connectorId) || '';
            let channelId = 'ddz:t:' + this.id;
            yield this.game.app.controllers.push.joinAsync(channelId, user.id, connectorId);

            // 坐下
            user.chairId = i;
            users[i] = user;
            joined = true;
            gold = player.gold;
        }
        if (users[i]) {
            let ready = users[i].isReady() ? '1' : '0';
            let player = yield this.game.app.models.Player.findByIdReadOnlyAsync(users[i].id, 'name sex headurl score gold');
            if (users[i]) {
				data.push({
					name: player.name,
					sex: player.sex,
					headurl: player.headurl,
					jifen: player.score,
					gold: String(player.gold),
					ready: ready,
					chairId: String(users[i].chairId)
				});
            }
        }
    }
    // 加入桌子之后
    yield this.afterJoinAsync(user);
    var table = { id: this.id };
    table.difen = String(this.difen);
    if (!user.isOwner()) {
        table.playing = this.isPlaying() ? '1' : '0';
        table.users = data;
    }
    return { code: C.OK, chairId: String(user.chairId), table: table, gold: String(gold) };
});

// 离开桌子
proto.leaveAsync = cor(function* (user) {
	let chairId = user.chairId;
	if (chairId != -1) {
		yield this.beforeLeaveAsync(user);
		delete this.users[chairId];
		delete this.handCards[chairId];
		yield this.afterLeaveAsync(user);
    }
});

// 开始游戏
proto.startGameAsync = cor(function* (user) {
    // 设置状态
    for (let user of this.users) {
        if (user) {
            if (user.isReady()) {
                user.state = User.STATE.PLAYING;
            }
        }
    }
    // 获取手牌
    let p_obj = Logic.licensing();
    this.handCards = p_obj.pokes;
    this.lastCards = p_obj.nowPokes;
    this.state = STATE.CALLING;

    // 重置倍数
    // for (let mul of this.muls) {
    //     mul.state = 1;
    //     mul.mul = this.minMul;
    // }
    // 跳过叫倍
    yield this.checkSendCardAsync();
    this.cur_time = Date.now();
    this.jushu++;
    // yield this.pushMsgAsync(-1, 'start', { bankerId: String(this.bankerId), cell: String(this.cell), mul: String(this.minMul), second: String(this.second) });
    return { code: C.OK };
});

// 结算游戏
proto.concludeGameAsync = cor(function* (scores) {
    // 重置状态
    this.resetStatus();
    // 协议数据
    var datas = [];
    for (let i = 0; i < scores.length; ++i) {
        if (this.handCards[i]) {
            datas.push({ chairId: String(i), score: String(scores[i]) });
        }
    }
    return this.pushMsgAsync(-1, 'conclude', datas);
});

// 检查结算
proto.checkConcludeAsync = cor(function* () {
    // 是否结束
    var isEnd = true;
    for (let handCard of this.handCards) {
        if (handCard && !handCard.state) {
            isEnd = false;
            break;
        }
    }
    if (isEnd) {
        let bankCard = this.handCards[this.bankerId];
        let scores = _.fill(Array(this.count), 0);
        for (let i = 0; i < this.handCards.length; ++i) {
            let handCard = this.handCards[i];
            if (handCard && i != this.bankerId) {
                let win = this.logic.compare(handCard, bankCard);
                if (win) {
                    let score = this.cell * this.muls[i].mul * handCard.type.mul;
                    scores[i] += score;
                    scores[this.bankerId] -= score;
                }
                else {
                    let score = this.cell * this.muls[this.bankerId].mul * bankCard.type.mul;
                    scores[this.bankerId] += score;
                    scores[i] -= score;
                }
            }
        }
        // 结算游戏
        return this.concludeGameAsync(scores);
    }
});

// 选择倍数
proto.setMultipleAsync = cor(function* (user, mul) {
    if (mul < this.minMul || mul > this.maxMul) {
        return { code: C.FAILD, msg: C.TABLE_MUL_ERROR };
    }
    var chairId = user.chairId;
    this.muls[chairId].state = 1;
    this.muls[chairId].mul = mul;

    yield this.pushMsgAsync(-1, 'multiple', [{ chairId: chairId, mul: mul }]);
    return this.checkSendCardAsync()
        .then(function () {
            return { code: C.OK };
        });
});

// 开始发牌
proto.checkSendCardAsync = cor(function* () {
    // 能否发牌
    var canSend = true;
    if (canSend) {
        for (let i = 0; i < this.handCards.length; ++i) {
            let handCard = this.handCards[i];
            if (handCard) {
                yield this.pushMsgAsync(i, 'calldizhu', { handCard: _.map(handCard, function (n) { return String(n) }) });
            }
        }
    }
});

//确定地主需要判定条件
proto.makesureDZAsync = cor(function* (user, fen) {
    if (this.chairId != -1) {
        return { code: C.FAILD, msg: C.TABLE_NOT_CALLING };
    }
    if (this.dizhu == -1) this.dizhu = user.chairId;
    else {
        if (fen > this.users[this.dizhu].jiaofen) {
            this.dizhu = user.chairId;
        } else if (fen == this.users[this.dizhu].jiaofen) {
            var r_index = _.sample([this.dizhu, user.chairId]);
            this.dizhu = r_index;
        }
    }
    var begin = true;
    for (let u of this.users) {
        if (!u || (u && u.jiaofen == -1)) {
            yield this.pushMsgAsync(-1, 'jiaofen', { chairId: user.chairId, jiaofen: user.jiaofen });
            return { code: C.OK };
        }
    }
    var dz_index = this.dizhu;
    var dz_user = this.users[dz_index];
    if (dz_index > 2) return { code: C.FAILD };
    this.chairId = this.dizhu;
    this.state = STATE.PLAYING;
    this.bet = this.bet * (dz_user.jiaofen || 1);
    this.handCards[dz_index] = this.handCards[dz_index].concat(this.lastCards);
    //确定地主后通知所有玩家
    yield this.pushMsgAsync(-1, 'makedizhu', { chairId: dz_index, bet: this.bet, dipai: _.map(this.lastCards, n => String(n)) });
    return { code: C.OK };
});

//获取上次出牌
proto.prePoke = function () {
    let rl = this.record.length;
    return (rl == 0) ? [] : this.record[rl - 1];
};

//出牌
proto.throwPokeAsync = cor(function* (user, pokes) {
    let prePoke = this.prePoke();
    let self_pre_poke = user.prePoke();
    let pl = prePoke.length;
    let spl = self_pre_poke.length;
    if (pokes.length == 0) {
        if ((pl == spl) && _.difference(prePoke, self_pre_poke).length == 0) return { code: C.FAILD, msg: C.TABLE_NOT_AUTH };
        this.chairId = (user.chairId == 2 ? 0 : (user.chairId + 1));
        //出牌成功，通知所有玩家出牌的牌型
        yield this.pushMsgAsync(-1, 'chupai', { count: this.handCards[user.chairId].length, cards: [], chairId: user.chairId, bet: this.bet, next: this.chairId });
        return { code: C.OK, handCard: _.map(this.handCards[user.chairId], function (n) { return String(n) }) };
    }
    var lpo = _.difference(this.handCards[user.chairId], pokes);
    var subl = this.handCards[user.chairId].length - pokes.length;
    if (lpo.length != subl || subl < 0) {
        return { code: C.FAILD, msg: C.TABLE_NOT_AUTH };
    }
    var pokeType = Logic.checkPoke(pokes);
    if (pokeType !== -1) {
        if (user.chairId != -1) {
            let doCompare = false;
            //是否需要比对
            if (spl !== pl) doCompare = true;
            else {
                if (pl > 0) {
                    if (spl == 0) doCompare = true;
                    if (spl > 0) {
                        let dif_poke = _.difference(prePoke, self_pre_poke);
                        if (dif_poke.length != 0) doCompare = true;
                    }
                }
            }
            //比对牌型
            if (doCompare) {
                let com_result = Logic.compare(prePoke, pokes);
                if (!com_result) return { code: C.FAILD, msg: C.TABLE_NOT_AUTH };
            }
            //出牌
            this.handCards[user.chairId] = lpo;
            this.record.push(pokes);
            user.record.push(pokes);
            this.chairId = (user.chairId == 2 ? 0 : (user.chairId + 1));
            //更新倍数
            if (pokeType == Logic.PT.BOM || pokeType == Logic.PT.GUI_BOM) {
                this.bom_count++;
                this.bet = this.bet * 2;
                this.bet = this.bet > TableConfig.bet_top ? TableConfig.bet_top : this.bet;
            };
            //出牌成功，通知所有玩家出牌的牌型
            yield this.pushMsgAsync(-1, 'chupai', { count: this.handCards[user.chairId].length, cards: _.map(pokes, function (n) { return String(n); }), chairId: user.chairId, next: this.chairId, bet: this.bet });
            if (this.handCards[user.chairId].length === 0) {
                //本局完成处理
                yield this.completeGameAsync(user);
            }
            return { code: C.OK, handCard: _.map(this.handCards[user.chairId], function (n) { return String(n) }) };
        }
        return { code: C.FAILD, msg: C.PLAYER_MISSING_ID };
    }
    return { code: C.FAILD, msg: C.TABLE_NOT_AUTH };
});

//初始化内容
proto.initContent = function () {
    this.state = STATE.FREE;
    this.handCards = Array(this.count);
    this.cur_time = 0;
    //底牌
    this.lastCards = [];
    //地主index
    this.dizhu = -1;
    //出牌记录
    this.record = [];
    //得胜者
    this.winner = -1;
    this.bom_count = 0;
    this.chuntian = 0;
    this.fan_chuntian = 0;
    this.bet = 1;
    this.chairId = -1;
};

//是否重新开始
proto.againGameAsync = cor(function* (user, y_n) {
    if (y_n) {
        let player = yield this.game.app.models.Player.findByIdReadOnlyAsync(user.id, 'gold');
        if (player && player.gold >= this.difen * TableConfig.join_rule) {
            user.state = User.STATE.READY;
            if (this.isFullReady()) {
                return { code: C.OK, nexts: [() => this.startGameAsync(user)] };
            }
        }
        else {
            yield this.pushMsgAsync(user.chairId, 'paraerr', { msg: C.TABLE_NOT_GOLD });
        }
        return { code: C.OK };
    } else {
        return this.leaveAsync(user);
    }
});

//计算结算
proto.countComplete = function () {
    var dizhu = this.users[this.dizhu];
    var difen = this.difen;
    //地主春天翻倍
    if (dizhu.record.length == 1) {
        this.bet = this.bet * 2;
        this.bet = this.bet > TableConfig.bet_top ? TableConfig.bet_top : this.bet;
        this.fan_chuntian++;
    }
    //农民春天翻倍
    let match = 0;
    for (var j = 0; j < this.users.length; j++) {
        if (j !== this.dizhu) {
            if (this.users[j].record.length == 0) match++;
        }
    }
    if (match == 2) {
        this.bet = this.bet * 2;
        this.bet = this.bet > TableConfig.bet_top ? TableConfig.bet_top : this.bet;
        this.chuntian++;
    }
    //结算
    var return_obj = [];
    for (var i = 0; i < this.users.length; i++) {
        let user = this.users[i];
        if (this.dizhu == i) {
            return_obj[i] = [2 * this.bet * difen, user.wateRate];
        } else {
            return_obj[i] = [this.bet * difen, user.wateRate];
        }
    }
    //增加还是减去积分
    if (this.winner != this.dizhu) {
        return_obj = _.map(return_obj, function (n, i) {
            if (i != dizhu.chairId) return Math.round(n[0] * (1 - n[1]));
            return -n[0];
        });
    } else {
        return_obj = _.map(return_obj, function (n, i) {
            if (i != dizhu.chairId) return -n[0];
            return Math.round(n[0] * (1 - n[1]));
        });
    }
    return return_obj;
};

//本局完成
proto.completeGameAsync = cor(function* (user) {
    this.resetStatus();
    this.winner = user.chairId; var bet = this.bet; var chuntian = this.chuntian; var fan_chuntian = this.fan_chuntian;
    let cc = this.countComplete();
    let b = { difen: this.difen, bet: this.bet };
    let return_obj = { data: cc, bet: b, bom: this.bom_count, chuntian: this.chuntian, fanchuntian: this.fan_chuntian };
    var before_jiesuan = []; var record_result = []; var record_arr = [];
    for (let u of this.users) {
        let pl = yield this.game.app.models.Player.findByIdAsync(u.id);
        var id = pl._id;
        before_jiesuan.push({ _id: id, score: pl.gold });
        record_arr.push({ _id: id, score: cc[u.chairId] });
        pl.gold += cc[u.chairId];
        record_result.push({ _id: id, score: pl.gold });
        yield pl.saveAsync();
        u.initContent();
    }
    this.initContent();
    var record = new this.game.app.models.DDZRecord({ _id: uuid.v1(), start_time: this.cur_time, table_id: this.id, before_jiesuan: before_jiesuan, table_jushu: this.jushu, jiesuan: record_arr, result: record_result });
    yield record.saveAsync();
    return this.pushMsgAsync(-1, 'complete', return_obj);
});

