'use strict';

var quick = require('quick-pomelo');
var P = quick.Promise;
var cor = P.coroutine;
var _ = require('lodash');
var logic = require('./logic');
var User = require('./user');
var C = require('../../share/constant');
var logger = quick.logger.getLogger('table', __filename);
var schedule = require('pomelo/node_modules/pomelo-scheduler');

// 桌子状态
var STATE = { FREE: 1, PLAYING: 2 };
var MAX_USERS = 5;
var SINGLE_BET = 1;
var MAX_BET = 4;

// 构造方法
var Table = function (game, id, ownerId) {
    this.game = game;
    this.id = id;
    this.ownerId = ownerId;

    this.state = STATE.FREE;
    this.currentId = -1;
    this.bet = 1;
    this.totalScore = 0;
    this.scores = [1, 1, 1, 1];
    this.has_users = [, , , ,];
    this.pokes = [];
    this.users = [, , , ,];
    this.rs = -1;
};

// 导出状态
Table.STATE = STATE;
Table.MAX_USERS = MAX_USERS;

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

//是否准备
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

//是否准备compare
proto.isReadyToCompare = function () {
    for (let user of this.users) {
        if (user) {
            if (!user.isCompare()) {
                return false;
            }
        }
    }
    return true;
};

// 获取人数
proto.getCount = function () {
    var count = 0;
    for (let user of this.users) {
        if (user) count += 1;
    }
    return count;
};

// 发送消息
proto.pushMsgAsync = cor(function* (index, route, msg) {
    var ids = [];
    if (index < 0 || index >= this.users.length) {
        for (let u of this.users) {
            if (u) {
                ids.push(u.id);
            }
        }
    }
    else {
        let user = this.users[index];
        if (user) {
            ids.push(user.id);
        }
    }
    if (ids.length > 0) {
        var channelId = 't:' + this.id;
        return this.game.app.controllers.push.pushAsync(channelId, ids, route, msg, false);
    }
});

// 加入桌子之后
proto.afterJoinAsync = cor(function* (user) {

});

proto.countPlayingUser = function () {
    let countUser = 0;
    for (let u of this.users) {
        if (u && u.state === User.STATE.PLAYING) {
            countUser++;
        }
    }
    return countUser;
};
proto.countUser = function () {
    let countUser = 0;
    for (let u of this.users) {
        if (u) {
            countUser++;
        }
    }
    return countUser;
};

// 离开桌子之前
proto.beforeLeaveAsync = cor(function* (user, index) {
    var channelId = 'tw:t:' + this.id;
    return this.game.app.controllers.push.quitAsync(channelId, user.id);
    // let ind = this.getNextCid(index);
    // let countUser = this.countUser();
    // if (countUser > 1) {
    //     if (this.ownerId === user.id) {
    //         let nextOwner = this.users[ind];
    //         this.ownerId = nextOwner.id;
    //         user = nextOwner;
    //     }
    //     yield this.pushMsgAsync(-1, 'change_owner', {
    //         chairId: user.chairId
    //     });
    // }
    // if (this.state === STATE.PLAYING) {
    //     ind = this.getNextLifeId(index);
    //     this.currentId === index ? this.currentId = ind : true;
    //     yield this.betTable(index, false);
    //     var count = this.countPlayingUser();
    //     if (count <= 2) {
    //         yield this.completeGameAsync(ind);
    //     }
    // }
});

// 加入桌子
proto.joinAsync = cor(function* (user) {
    var data = [];
    var joined = false;
    var users = this.users; var ownerChairId = -1;
    for (let i = 0; i < users.length; ++i) {
        if (!users[i] && !joined) {
            let player = yield this.game.app.models.Player.findByIdReadOnlyAsync(user.id, 'connectorId');
            let connectorId = (player && player.connectorId) || '';
            let channelId = 'tw:t:' + this.id;
            yield this.game.app.controllers.push.joinAsync(channelId, user.id, connectorId);
            // 坐下
            user.chairId = i;
            this.has_users[i] = user.id;
            users[i] = user;
            joined = true;
        }
        if (users[i]) {
            if (this.ownerId == users[i].id) {
                ownerChairId = i;
            }
            let player = yield this.game.app.models.Player.findByIdReadOnlyAsync(users[i].id, 'name sex headUrl');
            data.push({
                name: player.name,
                sex: player.sex,
                headUrl: player.headUrl,
                ready: users[i].state === User.STATE.READY ? 1 : 0,
                chairId: String(users[i].chairId),
                score: String(users[i].score)
            });
        }
    }
    // 加入桌子之后
    yield this.afterJoinAsync(user);
    var own = user.isOwner() ? '1' : '0';
    let u = data[_.findIndex(data, { chairId: String(user.chairId) })];
    let returnObj = { code: C.OK };
    returnObj.table = {};
    returnObj.table.id = this.id;
    if (this.ownerId !== user.id) {
        yield this.pushMsgAsync(-1, 'join', {
            name: u.name,
            sex: u.sex,
            headUrl: u.headUrl,
            ready: u.state === User.STATE.READY ? 1 : 0,
            score: u.score,
            chairId: u.chairId
        });
        returnObj.table.users = data;
        returnObj.table.curState = this.state;
        returnObj.table.chairId = user.chairId;
        returnObj.table.ownerChairId = ownerChairId;
    }
    return returnObj;
});

// 离开桌子
proto.leaveAsync = cor(function* (playerId) {
    var index = _.findIndex(this.users, { id: playerId });
    if (-1 == index) {
        return { code: C.FAILD, msg: C.TABLE_NOT_USER };
    }
    // 离开桌子之前
    yield this.beforeLeaveAsync(this.users[index], index);
    //if(this.users[index].state === User.STATE.PLAYING){
    //    yield this.giveUpPokeAsync(playerId);
    //}
    delete this.users[index];
    delete this.pokes[chairId];
    yield this.pushMsgAsync(-1, 'leave', { leaveChairId: index });
    return { code: C.OK };
});

// 开始游戏
proto.startGameAsync = cor(function* (playerId) {
    var self = this;
    var players = [];
    for (let user of self.users) {
        if (user) {
            // let player = yield this.game.app.models.Player.findByIdReadOnlyAsync(user.id, 'rate');
            players.push(1);
            continue;
        }
        players.push(0);
    }
    this.pokes = logic.getPoke(players);
    this.currentId = _.findIndex(self.users, { id: playerId });
    this.state = STATE.PLAYING;
    for (var index = 0; index < self.users.length; index++) {
        if (this.users[index]) {
            // this.totalScore++;
            this.users[index].state = User.STATE.PLAYING;
            // this.users[index].poke = this.pokes[index];
            yield this.pushMsgAsync(index, 'start', {
                cards: this.pokes[index]
            });
        }
    }
    return { code: C.OK };
});

proto.startCompareAsync = cor(function* (user) {
    var users = this.users;
    user.compareStatus = true;
    //比牌
    var pl = function (cards) {
        var l = []; var m = 0;
        // 牌型大小排序
        var pl1 = function (b) {
            var bj = _.clone(b[0]);
            var seat = cards.length;
            for (var i = 1; i < b.length; i++) {
                var p = _.clone(bj);
                var cp = _.clone(b[i]);
                var c = !!compare(p, cp);
                if (!c) seat -= 1;
            }
            l.push(seat);
            m++;
            if (m >= cards.length) return false;
            b.shift();
            b.push(bj);
            return pl1(b);
        }
        pl1(cards);
        return l;
    }
    //所有人确定比牌
    if (this.isReadyToCompare()) {
        var cps = []; var ty = [];
        var users = this.users; var allCards = [];
        for (let i = 0; i < users.length; ++i) {
            var u = users[i];
            if (users[i]) {
                allCards.push(u.poke);
                if (typeof u.poke == 'object') {
                    cps.push(u.poke);
                } else {
                    ty[i] = u.poke;
                }
            } else {
                allCards.push(0);
            }
        }
        //按顺序提出牌面
        var t = [], tt = [];
        for (var j = 0; j < 3; j++) {
            var ctc = []; var ctt = [];
            for (var n = 0; n < cps.length; n++) {
                ctc.push(cps[n][j].cards);
                ctt.push(cps[n][j].type);
            }
            t.push(ctc);
            tt.push(ctt);
        }
        //循环比较  按位置返回大小
        var rs = [];
        for (var i in t) {
            rs.push(pl(t[i]));
        }
        //空位胜负补0
        for (let i = 0; i < users.length; ++i) {
            if (!users[i]) {
                for (var r in rs) {
                    rs[r].splice(i, 0, 0);
                    tt[r].splice(i, 0, 0);
                }
            }
        }
        this.rs = { rs: rs, tt: tt };
        var rsr = this.countFold(ty);
        console.warn('rsr', rsr, rs);
        yield this.pushMsgAsync(-1, 'result', { count: rsr, result: rs, allCards: allCards });
        return { code: C.OK };
    } else {
        return { code: C.OK };
    }
})
/**
 * 根据结果大小结算结果分数和倍数
 * @param {*} rs 
 * @return {Array} [{count:fenshu,qld:true|false,lose:[[1,2],[1,2]],dq:[1,2,3]}]
 */
var countByBS = function (rs, tt) {
    var ruleCount = rs[0].length;
    var transTypeToScore = function (t, index) {
        var t_y = logic.c_t;
        switch (t) {
            case t_y.CS: return index == 0 ? 3 : 0;
            case t_y.HL: return index == 1 ? 2 : 0;
            case t_y.TZ: return index == 2 ? 4 : 8;
            case t_y.THS: return index == 2 ? 5 : 10;
            default: return 0;
        }
    }
    //ri 接下来要检查的index   sr  结果
    var cicleCheckInRs = function (ri, sr, sa) {
        //clone结果
        ri = ri || 0;
        sr = sr || [];
        sa = sa || [0, 0, 0, 0];
        //[[1,3,2,0],[2,3,1,0],[3,2,1,0]]
        var rc = _.clone(rs);
        if (rc[0][ri] == 0) {
            sr[ri] = 0;
            ri++;
            if (ri >= ruleCount) return sr;
            return cicleCheckInRs(ri, sr, sa);
        }
        sr[ri] = sr[ri] || { count: 0, lose: [] }
        var count = [];
        for (var i in rc) {
            //rc[i] [1,3,2,0]
            var lose = []; var ct = [];
            for (var j in rc[i]) {
                if (j != ri) {
                    var checkToV = rc[i][ri];
                    var checkToT = tt[i][ri];
                    if (rc[i][j] != 0) {
                        var tCount = 0;
                        var asc = 0;
                        if (checkToV < rc[i][j]) {
                            lose.push(Number(j));
                            asc = transTypeToScore(checkToT, Number(i));
                            if (asc > 0) tCount += asc;
                            else tCount++;
                        }
                        if (checkToV > rc[i][j]) {
                            asc = transTypeToScore(tt[i][j], Number(i));
                            if (asc > 0) tCount -= asc;
                            else tCount--;
                        }
                        ct[j] = tCount;
                        sr[ri].count += tCount;
                    }
                }
            }
            sr[ri].lose.push(lose);
            count.push(ct);
        }
        var dq = _.intersection.apply(null, sr[ri].lose);
        if (dq.length > 0) {
            var bet = 2;
            if (dq.length >= 3) {
                bet = 4;
                sr[ri].qld = true;
            }
            sr[ri].dq = dq;
            count1 = _.map(count, function (n) { return _.map(n, function (m, l) { return dq.indexOf(l) != -1 ? m * bet : m }) });
            var subCount = _.map(count, function (n, i) { return _.zipWith(count1[i], n, function (a, b) { return a - b; }) });
            count2 = _.zip.apply(null, subCount);
            var changeS = _.map(count2, function (n) { return _.sum(n) });
            changeS = _.map(changeS, function (n) {
                if (_.isNaN(n)) {
                    return 0;
                }
                return n ? n : 0;
            })
            while (changeS.length < 4) {
                changeS.push(0);
            }
            sa = _.zipWith(sa, changeS, function (a, b) { return a + b });
            _.map(changeS, function (n, i) { return dq.indexOf(i) != -1 ? sr[ri].count += n : true });
        }
        ri++;
        if (ri >= ruleCount) return { sr: sr, sa: sa };
        return cicleCheckInRs(ri, sr, sa);
    }
    var ndd = cicleCheckInRs();
    for (var i in ndd.sa) {
        if (ndd.sa[i] > 0) {
            ndd.sr[i].count -= ndd.sa[i];
        }
    }
    return ndd.sr;
};

//计算番数
proto.countFold = function (ty) {
    var rs = this.rs.rs;
    var tt = this.rs.tt;
    var speTrans = function (t) {
        var at = logic.all_type;
        switch (t) {
            case at.QL:
            case at.YTL: return 52;
            case at.SSZ:
            case at.STH:
            case at.LDB: return 6;
            default: return 0;
        }
    };
    //牌型大小和类型计分
    var cr = countByBS(rs, tt);
    //特殊牌型计算
    if (ty.length > 0) {
        console.warn('ty',ty);
        for (var i in ty) {
            if (ty[i]) {
                var score = speTrans(ty[i]);
                var cty = _.compact(_.map(_.clone(ty), function (n, a) { return i == a ? 0 : n }));
                var ccr = _.compact(_.clone(cr));
                var s = 0;
                for (var j in cty) {
                    if (cty[j] < ty[i]) s += score;
                    if (cty[j] > ty[i]) s -= score;
                }
                s += (score * ccr.length);
                cr[i] = { count: s, dq: [] };
                if (ccr.length >= 3) cr[i].qld = true;
                for (var m in cr) {
                    if (typeof cr[m] == 'object') {
                        cr[m].count -= score;
                        cr[i].dq.push(Number(m));
                    }
                }
            }
        }
    }
    this.defaultRound();
    return cr;
};

proto.giveUpSchedule = function (times) {
    var app = this.game.app;
    var index = this.currentId;
    var playerId = this.users[index].id;
    times = times || 15;
    this.users[index].schedule = schedule.scheduleJob({ start: Date.now() + (times * 1000) }, function () {
        app.memdb.goose.transactionAsync(P.coroutine(function* () {
            return app.controllers.tw.giveUpPokeAsync(playerId);
        }), app.getServerId())
            .then(function (result) {
                app.event.emit('transactionSuccess');
                return result;
            }).nodeify(function () {
                logger.info('==giveUp==goldenRemote.giveUp callback: ', arguments);
            });
    }, {});
};

proto.cancelJob = function (id) {
    id = this.users[this.currentId].schedule;
    if (id !== -1) schedule.cancelJob(id);
};

proto.getCurScore = function (isSee) {
    return SINGLE_BET * this.bet * (isSee ? 2 : 1);
};

proto.getNextCid = function (index) {
    let changeUsers = _.clone(this.users);
    let spliceUsers = changeUsers.splice(0, (index + 1));
    changeUsers = changeUsers.concat(spliceUsers);
    for (let u = 0; u < changeUsers.length; u++) {
        if (changeUsers[u]) {
            return _.findIndex(this.users, { id: changeUsers[u].id });
        }
    }
    return -1;
};
//下一个在场的椅子ID
proto.getNextLifeId = function (index) {
    let changeUsers = _.clone(this.users);
    let spliceUsers = changeUsers.splice(0, (index + 1));
    changeUsers = changeUsers.concat(spliceUsers);
    for (let u = 0; u < changeUsers.length; u++) {
        if (changeUsers[u] && changeUsers[u].state === User.STATE.PLAYING) {
            return _.findIndex(this.users, { id: changeUsers[u].id });
        }
    }
    return -1;
};

//加注
proto.addBetAsync = cor(function* (playerId) {
    let index = _.findIndex(this.users, { id: playerId });
    if (index === -1) return { code: C.FAILD, msg: C.TABLE_NOT_USER };
    if (this.users[index].schedule !== -1) {
        this.cancelJob(this.users[index].schedule);
    }
    if (this.bet * 2 > MAX_BET) {
        return { code: C.FAILD };
    }
    if (this.currentId !== index) return { code: C.FAILD, msg: C.PLAYER_HAD_ADD };
    let ind = this.getNextLifeId(index);
    if (ind === -1) return { code: C.FAILD, msg: C.TABLE_NOT_USER };
    this.bet = this.bet * 2;
    this.currentId = ind;
    let user = this.users[index];
    user.addBet(user.isSee ? this.bet * 2 : this.bet);
    this.scores[index] = user.bet_score;
    yield this.betTable(index);
    /* TODO
     this.giveUpSchedule();
     */
    return { code: C.OK, msg: { bet: this.bet, currentId: this.currentId } };
});

//跟注
proto.followBetAsync = cor(function* (playerId) {
    let index = _.findIndex(this.users, { id: playerId });
    if (index === -1) return { code: C.FAILD, msg: C.TABLE_NOT_USER };
    if (this.users[index].schedule !== -1) {
        this.cancelJob(this.users[index].schedule);
    }
    if (this.currentId !== index) return { code: C.FAILD, msg: C.PLAYER_HAD_ADD };
    let ind = this.getNextLifeId(index);
    if (ind === -1) return { code: C.FAILD, msg: C.TABLE_NOT_USER };
    let user = this.users[index];
    user.addBet(user.isSee ? this.bet * 2 : this.bet);
    this.scores[index] = user.bet_score;
    this.currentId = ind;
    yield this.betTable(index);
    /* TODO
     this.giveUpSchedule();
     */
    return { code: C.OK, msg: { bet: this.bet, currentId: this.currentId } };
});


proto.comparePokeAsync = cor(function* (playerId, pkId, win) {
    // let tus = _.clone(this.users);
    // let ind = _.findIndex(tus, { id: playerId });
    // if (this.users[ind].schedule !== -1) {
    //     this.cancelJob(this.users[ind].schedule);
    // }
    // if (this.currentId !== ind) return { code: C.FAILD, msg: C.PLAYER_HAD_ADD };
    // let user = tus[ind];
    //加分
    // user.addBet(this.bet * SINGLE_BET);
    // this.scores[ind] = user.bet_score;
    // let pkUser = tus[pkId];
    // let players = [];
    // let count = tus.length;
    // for (let index = 0; index < tus.length; index++) {
    //     if (!tus[index]) {
    //         players.push([]);
    //         count--;
    //         continue;
    //     } else {
    //         var t = tus[index];
    //         players.push({ poke: t.poke, score: t.bet_score });
    //     }
    //     if (tus[index].state !== User.STATE.PLAYING) {
    //         count--;
    //     }
    // }
    // let indE = this.getNextLifeId(ind);
    // if (indE !== -1) {
    //     this.currentId = indE;
    // }
    // indE = this.currentId;
    yield this.pushMsgAsync(-1, 'compareResult', {
        srcChair: user.chairId,
        targetChair: pkUser.chairId,
        winChair: win ? pkUser.chairId : user.chairId
    });
    // yield this.betTable(ind);
    // if (count === 1) {
    //     yield this.completeGameAsync(win ? user.chairId : pkUser.chairId);
    // }
    /* TODO 定时任务
     if (count !== 1 && this.currentId !== ind) {
     this.giveUpSchedule();
     }
     */

    return { code: C.OK };
});

proto.giveUpPokeAsync = cor(function* (playerId) {
    let tus = this.users;
    let ind = _.findIndex(tus, { id: playerId });
    if (this.users[ind].schedule !== -1) {
        this.cancelJob(this.users[ind].schedule);
    }
    let user = tus[ind];
    let players = [];
    let count = tus.length;
    for (let index = 0; index < tus.length; index++) {
        if (!tus[index]) {
            count--;
            players.push([]);
            continue;
        } else {
            var t = tus[index];
            players.push({ poke: t.poke, score: t.bet_score });
        }
        if (tus[index].state !== User.STATE.PLAYING) {
            count--;
        }
    }
    let indE = this.getNextLifeId(ind);
    if (indE !== -1) {
        this.currentId = indE;
    }
    indE = this.currentId;
    yield user.table.pushMsgAsync(-1, 'giveUp', {
        base: SINGLE_BET,
        maxMultiple: MAX_BET,
        multiple: this.bet,
        total: this.totalScore,
        curScore: this.getCurScore(this.users[indE].isSee),
        curChairId: this.currentId,
        giveUpChairId: user.chairId,
        nextChairId: indE
    });
    yield this.betTable(user.chairId, false);
    if (count === 1) {
        yield this.completeGameAsync(this.currentId);
    }
    /* TODO
     if (count !== 1 && this.currentId !== ind) {
     this.giveUpSchedule();
     }
     */
    return { code: C.OK };
});
proto.defaultRound = function () {
    this.state = STATE.FREE;
    this.currentId = -1;
    this.bet = 1;
    this.rs = -1;
    this.totalScore = 0;
    this.scores = [1, 1, 1, 1, 1];
    this.pokes = [];
    for (let user of this.users) {
        if (user) {
            user.defaultRound();
        }
    }
};
proto.completeGameAsync = cor(function* (winChairId) {
    let tus = _.clone(this.users);
    let players = [];
    for (let index = 0; index < tus.length; index++) {
        if (!tus[index]) {
            continue;
        }
        if (this.users[index].state !== User.STATE.FREE) {
            players.push({
                poke: this.pokes[index],
                name: tus[index].name,
                score: winChairId === index ? (this.totalScore - this.scores[index]) : this.scores[index],
                win: winChairId === index ? 1 : 0
            });
        }
        this.users[index].state = User.STATE.FREE;
    }
    this.defaultRound();
    return this.pushMsgAsync(-1, 'result', {
        data: players
    });
});
proto.betTable = cor(function* (index, zero) {
    zero = zero || true;
    return this.pushMsgAsync(-1, 'bet', {
        base: SINGLE_BET,
        maxMultiple: MAX_BET,
        multiple: this.bet,
        total: this.totalScore,
        curScore: this.users[this.currentId] ? this.getCurScore(this.users[this.currentId].isSee) : 0,
        curChairId: this.currentId,
        preChairId: index,
        preScore: zero ? this.getCurScore(this.users[index].isSee) : 0
    });
});