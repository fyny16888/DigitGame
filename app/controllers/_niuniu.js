'use strict';

var quick = require('quick-pomelo');
var P = quick.Promise;
var _ = require('lodash');
var C = require('../../share/constant');
var H = require('../../share/const').TASK_TYPE;
var logic = require('../niuniu/logic.js');
var util = require('util');
var logger = quick.logger.getLogger('_niuniu', __filename);

// 构造方法
var Controller = function (app) {
	this.app = app;
	this.id = 10003;
	this.startTime = 0;
	this.bankerWin = 0;
	this.countdown = 30000;
	this.config = {};
	this.pokes = [];
	if (app.getServerType() == '_niuniu') {
		app.event.on('start_all', () => {
			var self = this;
			return app.memdb.goose.transactionAsync(P.coroutine(function* () {
				return self._resetGameAsync();
			}), app.getServerId())
				.then(() => app.event.emit('transactionSuccess'), () => app.event.emit('transactionFail'))
				.then(() => this._loadConfigAsync())
				.then(() => this._startGameAsync());
		});
	}
};

// 导出方法
module.exports = function (app) {
	return new Controller(app);
};

// 原型对象
var proto = Controller.prototype;

proto._resetGameAsync = P.coroutine(function* () {
	var gameBets = yield this.app.models.GoldenGame.findByIdAsync(this.id);
	if (gameBets) {
		gameBets.seats = [
			{ _id: 1, player: '0' },
			{ _id: 2, player: '0' },
			{ _id: 3, player: '0' },
			{ _id: 4, player: '0' },
			{ _id: 5, player: '0' },
			{ _id: 6, player: '0' },
			{ _id: 7, player: '0' },
			{ _id: 0, player: '0' }
		];
		gameBets.bankers = [];
		gameBets.banker = '0';
		gameBets.bankCount = 10;
		yield gameBets.saveAsync();
	}
});

// 开始游戏
proto._startGameAsync = P.coroutine(function* () {
	var self = this;
	this.bankerWin = 0;
	var app = self.app;
	var gameServers = this.app.getServersByType('niuniu');
	var serverCount = 0;
	var niuniuRemote = this.app.rpc.niuniu.niuniuRemote;
	return niuniuRemote.startGame.toServer('*', this.config, () => {
		serverCount += 1;
		if (serverCount >= gameServers.length) {
			return app.memdb.goose.transactionAsync(P.coroutine(function* () {
				return self._resetAsync()
					.then((time) => {
						// self.startTime = time;
						return setTimeout(() => self._endGameAsync(), self.config.all_time);
					});
			}), app.getServerId())
				.then(() => app.event.emit('transactionSuccess'), () => app.event.emit('transactionFail'));
		}
	});
});

// 结束游戏
proto._endGameAsync = P.coroutine(function* () {
	yield this._genResultAsync();
	var self = this;
	var app = self.app;
	var gameServers = this.app.getServersByType('niuniu');
	var serverCount = 0;
	var niuniuRemote = this.app.rpc.niuniu.niuniuRemote;
	return niuniuRemote.endGame.toServer('*', this.pokes, this.bankerWin, () => {
		serverCount += 1;
		if (serverCount >= gameServers.length) {
			return app.memdb.goose.transactionAsync(P.coroutine(function* () {
				return self._recordAsync();
			}), app.getServerId())
				.then(() => app.event.emit('transactionSuccess'), () => app.event.emit('transactionFail'))
				.then(() => this._globalEndAsync())
				.then(() => self._nextBanker())
				.then(() => this._startGameAsync());
		}
	});
});

// 公共数据处理
proto._globalEndAsync = P.coroutine(function* () {
	var self = this;
	var app = this.app;
	var gift = 0;
	return app.memdb.goose.transactionAsync(P.coroutine(function* () {
		var gameBets = yield app.models.GoldenGame.findByIdAsync(self.id);
		var globalData = gameBets.global_obj;
		var winnerCount = globalData.winnerCount;
		var maxs = globalData.max_obj;
		if (maxs && maxs.length > 0) {
			maxs = _.sortBy(maxs, 'gold');
			var max_o = maxs[maxs.length - 1];
			var player = yield app.models.Player.findByIdReadOnlyAsync(max_o._id, 'name sex gold headurl vip');
			if (max_o.gold > 1000000000) {
				yield app.controllers.hall.broadcastAsync(null, util.format('1:%d:%d:%d:%s', player.vip, self.id, max_o.gold, player.name));
			}
		}
		if (gameBets.gift >= 10000) {
			let rand = Math.random();
			if (rand < 0.01 && winnerCount > 0) {
				gift = Math.floor(gameBets.gift * 0.001 / winnerCount);
				gameBets.gift -= (gameBets.gift * 0.001);
				yield gameBets.saveAsync();
			}
		}
	}), app.getServerId())
		.then(() => app.event.emit('transactionSuccess'), () => app.event.emit('transactionFail'))
		.then(() => {
			return P.promisify((cb) => {
				var gameServers = app.getServersByType('niuniu');
				var serverCount = 0;
				let niuniuRemote = this.app.rpc.niuniu.niuniuRemote;
				return niuniuRemote.transGlobalData.toServer('*', gift, () => {
					serverCount += 1;
					if (serverCount >= gameServers.length) {
						return cb();
					}
				});
			})();
		});
});

// 可用庄家
proto._validBankAsync = P.coroutine(function* (bankers) {
	for (let i = 0; i < bankers.length; ++i) {
		let player = yield this.app.models.Player.findByIdReadOnlyAsync(bankers[i], 'gold');
		if (player && player.gold >= this.config.min_gold) {
			return { index: i, banker: bankers[i] };
		}
	}
});

// 轮换庄家
proto._nextBanker = P.coroutine(function* () {
	var data = null;
	var self = this;
	var app = this.app;
	return app.memdb.goose.transactionAsync(P.coroutine(function* () {
		var gamebets = yield app.models.GoldenGame.findByIdAsync(self.id);
		var pos = 999;
		if (gamebets.banker == '0') {
			if (gamebets.bankers.length > 0) {
				let bank = yield self._validBankAsync(gamebets.bankers);
				if (bank) {
					gamebets.banker = bank.banker;
					gamebets.bankers.splice(bank.index, 1);
					gamebets.bankCount = 10;
					pos = bank.index + 1;
				}
			}
		}
		else if (gamebets.bankCount <= 0) {
			if (gamebets.bankers.length > 0) {
				let bank = yield self._validBankAsync(gamebets.bankers);
				if (bank) {
					gamebets.banker = bank.banker;
					gamebets.bankers.splice(bank.index, 1);
					pos = bank.index + 1;
				}
				else gamebets.banker = '0';
			}
			else {
				gamebets.banker = '0';
			}
			gamebets.bankCount = 10;
		}
		if (gamebets.isModified()) {
			let bankerSeat = -1;
			var sea = _.find(gamebets.seats, { player: gamebets.banker });
			if (sea) {
				sea.player = '0';
				bankerSeat = sea._id;
			}
			yield gamebets.saveAsync();
			data = { banker: gamebets.banker, bankerSeat: bankerSeat, pos: pos };
		}
	}), app.getServerId())
		.then(() => app.event.emit('transactionSuccess'), () => app.event.emit('transactionFail'))
		.then(() => {
			if (data) {
				return P.promisify((cb) => {
					var gameServers = self.app.getServersByType('niuniu');
					var serverCount = 0;
					let niuniuRemote = self.app.rpc.niuniu.niuniuRemote;
					return niuniuRemote.changeBanker.toServer('*', data.banker, data.bankerSeat, data.pos, () => {
						serverCount += 1;
						if (serverCount >= gameServers.length) {
							return cb();
						}
					});
				})();
			}
		});
});

// 重置数据
proto._resetAsync = P.coroutine(function* () {
	var gamebets = yield this.app.models.GoldenGame.findByIdAsync(this.id);
	if (!gamebets) {
		gamebets = new this.app.models.GoldenGame({
			_id: this.id, muls: [
				{ _id: 0, mul: 1 },
				{ _id: 1, mul: 1 },
				{ _id: 2, mul: 1 },
				{ _id: 3, mul: 1 },
				{ _id: 4, mul: 1 },
				{ _id: 5, mul: 1 },
				{ _id: 6, mul: 1 },
				{ _id: 7, mul: 2 },
				{ _id: 8, mul: 2 },
				{ _id: 9, mul: 2 },
				{ _id: 10, mul: 3 },
				{ _id: 11, mul: 4 },
				{ _id: 12, mul: 5 },
				{ _id: 13, mul: 8 }
			]
		});
	} else {
		gamebets.result = {};
		gamebets.global_obj = {};
		for (let i of gamebets.bets) {
			i.score = 0;
		}
		gamebets.startTime = Date.now();
		gamebets.markModified('result');
	}
	return gamebets.saveAsync().then(() => gamebets.startTime);
});

// 游戏记录
proto._recordAsync = P.coroutine(function* () {
	var gamerecord = yield this.app.models.GoldenRecord.findByIdAsync(this.id);
	if (!gamerecord) {
		gamerecord = new this.app.models.GoldenRecord({ _id: this.id });
	}
	gamerecord.records = gamerecord.records || [];
	var rec = { _id: Date.now() };
	var gamebets = yield this.app.models.GoldenGame.findByIdReadOnlyAsync(this.id);
	if (gamebets) {
		rec.bets = gamebets.bets;
		rec.result = gamebets.result;
		rec.gift = gamebets.gift;
		// if (_.findIndex(rec.bets, (i) => (i.score > 0)) != -1) {
		// gamerecord.markModified('result');		
		if (rec.result) {
			gamerecord.records.unshift(rec);
			if (gamerecord.records.length > 10) gamerecord.records.pop();
			gamerecord.markModified('records');
			return gamerecord.saveAsync();
		}
		// }
	}
});

// 庄家输赢
proto._bankerWin = function (gamebets) {
	var result = gamebets.result;
	var types = result.types;
	var win = result.win;
	var jsa = result.jsa;
	var lose = result.lose;
	var bankerMu = jsa[0];
	var ws = 0;
	for (let w of win) {
		var ret = gamebets.bets.id(w);
		var muls = jsa[w];
		if (ret) {
			ws += muls * ret.score;
		}
	}
	var ls = 0;
	for (let l of lose) {
		var re = gamebets.bets.id(l);
		if (re) {
			ls += bankerMu * re.score;
		}
	}
	this.bankerWin = ls - ws;
	return this.bankerWin;
};

proto.testCalcResult = function (banker) {
	if (typeof banker == 'undefined') banker = '0';
	var Logic = new logic();
	var niuArr = Logic.getHandCards([1, 1, 1, 1, 1]);
	var types = []; var ct = [];
	var returnPokes = _.map(niuArr, function (niu) { return niu.cards });
	ct = _.clone(niuArr);
	var muls = [
		{ _id: 0, mul: 1 },
		{ _id: 1, mul: 1 },
		{ _id: 2, mul: 1 },
		{ _id: 3, mul: 1 },
		{ _id: 4, mul: 1 },
		{ _id: 5, mul: 1 },
		{ _id: 6, mul: 1 },
		{ _id: 7, mul: 2 },
		{ _id: 8, mul: 2 },
		{ _id: 9, mul: 2 },
		{ _id: 10, mul: 3 },
		{ _id: 11, mul: 4 },
		{ _id: 12, mul: 5 },
		{ _id: 13, mul: 8 }
	];
	//根据概率对牌组重新排序
	// var apos = _.clone(returnPokes);
	var l = []; var m = 0;
	var pl = function (b) {
		var bj = _.clone(b[0]);
		var seat = 4;
		for (var i = 1; i < b.length; i++) {
			var p = _.clone(bj);
			var cp = _.clone(b[i]);
			var c = Logic.compare(p, cp);
			if (c) seat -= 1;
		}
		l.push(seat);
		m++;
		if (m > 4) return false;
		b.shift();
		b.push(bj);
		return pl(b);
	}
	pl(ct);
	var percent = this.config.sys_percent;
	var rr = _.random(1,100);
	if (banker != '0') {
		percent = this.config.player_percent;
	}
	var cp = 0; var mp = 0;
	for (var k = 0; k < percent.length; k++) {
		cp += percent[k];
		if (cp >= rr) {
			mp = k;
			break;
		}
	}
	var cpp = _.clone(returnPokes);
	var changePoke = []; var cl = -1; var changeIndex = -1; var cna = _.clone(niuArr);
	var cnb = {};
	changeIndex = _.findIndex(l, function (n) { return n == mp });
	if (changeIndex != -1) {
		changePoke = _.clone(cpp[changeIndex]);
		cl = _.clone(l[changeIndex]);
		cnb = _.clone(niuArr[changeIndex]);
		cpp.splice(changeIndex, 1);
		l.splice(changeIndex, 1);
		cna.splice(changeIndex, 1);
		cna.unshift(cnb);
		cpp.unshift(changePoke);
		l.unshift(cl);
		returnPokes = cpp;
	}
	//pokes牌型
	types = _.map(cna, function (niu) { return niu.type.niu });
	var COUNT = 5;
	var getLogic = function (card) {
		var val = card % 100;
		if (val > 10) {
			return 10;
		}
		return val;
	};
	returnPokes = _.map(returnPokes, function (cards, n) {
		var i_i = 0; var i_j = 1; var s_i = false;
		for (let i = 0; i < COUNT - 1; ++i) {
			for (let j = i + 1; j < COUNT; ++j) {
				if ((getLogic(cards[i]) + getLogic(cards[j])) % 10 == types[n]) {
					i_i = i; i_j = j; s_i = true;
					break;
				}
			}
			if (s_i) break;
		}
		var ida = cards[i_i]; var jda = cards[i_j];
		_.remove(cards, function (n) { return n == ida || n == jda; })
		cards.push(ida, jda);
		return cards;
	});
	//和庄家比对输赢
	var win = [];
	var lose = [];
	var jsa = [muls.id(types[0]).mul];
	for (var j = 1; j < returnPokes.length; j++) {
		var p = l[0];
		var cp = l[j];
		var c = (cp > p);
		jsa.push(muls.id(types[j]).mul);
		if (c) {
			lose.push(j);
		} else {
			win.push(j);
		};
	}
	return {
		win: win,
		lose: lose,
		jsa: jsa,
		types: types,
		pokes: returnPokes
	};
};

// 计算开奖
proto._calcResult = function (gamebets) {
	var Logic = new logic();
	var niuArr = Logic.getHandCards([1, 1, 1, 1, 1]);
	var types = []; var ct = [];
	this.pokes = _.map(niuArr, function (niu) { return niu.cards });
	ct = _.clone(niuArr);
	var muls = gamebets.muls;
	//根据概率对牌组重新排序
	// var apos = _.clone(this.pokes);
	var l = []; var m = 0;
	var pl = function (b) {
		var bj = _.clone(b[0]);
		var seat = 4;
		for (var i = 1; i < b.length; i++) {
			var p = _.clone(bj);
			var cp = _.clone(b[i]);
			var c = Logic.compare(p, cp);
			if (c) seat -= 1;
		}
		l.push(seat);
		m++;
		if (m > 4) return false;
		b.shift();
		b.push(bj);
		return pl(b);
	}
	pl(ct);
	var percent = this.config.sys_percent;
	var rr = _.random(1,100);
	if (gamebets.banker != '0') {
		percent = this.config.player_percent;
	}
	var cp = 0; var mp = 0;
	for (var k = 0; k < percent.length; k++) {
		cp += percent[k];
		if (cp >= rr) {
			mp = k;
			break;
		}
	}
	var cpp = _.clone(this.pokes);
	var changePoke = []; var cl = -1; var changeIndex = -1; var cna = _.clone(niuArr);
	var cnb = {};
	changeIndex = _.findIndex(l, function (n) { return n == mp });
	if (changeIndex != -1) {
		changePoke = _.clone(cpp[changeIndex]);
		cl = _.clone(l[changeIndex]);
		cnb = _.clone(niuArr[changeIndex]);
		cpp.splice(changeIndex, 1);
		l.splice(changeIndex, 1);
		cna.splice(changeIndex, 1);
		cna.unshift(cnb);
		cpp.unshift(changePoke);
		l.unshift(cl);
		this.pokes = cpp;
	}
	//pokes牌型
	types = _.map(cna, function (niu) { return niu.type.niu });
	var COUNT = 5;
	var getLogic = function (card) {
		var val = card % 100;
		if (val > 10) {
			return 10;
		}
		return val;
	};
	this.pokes = _.map(this.pokes, function (cards, n) {
		var i_i = 0; var i_j = 1; var s_i = false;
		for (let i = 0; i < COUNT - 1; ++i) {
			for (let j = i + 1; j < COUNT; ++j) {
				if ((getLogic(cards[i]) + getLogic(cards[j])) % 10 == types[n]) {
					i_i = i; i_j = j; s_i = true;
					break;
				}
			}
			if (s_i) break;
		}
		var ida = cards[i_i]; var jda = cards[i_j];
		_.remove(cards, function (n) { return n == ida || n == jda; })
		cards.push(ida, jda);
		return cards;
	});
	//和庄家比对输赢
	var win = [];
	var lose = [];
	var jsa = [muls.id(types[0]).mul];
	for (var j = 1; j < this.pokes.length; j++) {
		var p = l[0];
		var cp = l[j];
		var c = (cp > p);
		jsa.push(muls.id(types[j]).mul);
		if (c) {
			lose.push(j);
		} else {
			win.push(j);
		};
	}
	return {
		win: win,
		lose: lose,
		jsa: jsa,
		types: types,
	};
};

proto._loadConfigAsync = P.coroutine(function* () {
	var self = this;
	var app = self.app;
	return app.memdb.goose.transactionAsync(P.coroutine(function* () {
		var config = yield app.models.GameConfig.findByIdReadOnlyAsync(self.id);
		if (config) self._selfLoad(config.config);
		if (!config) {
			self._selfLoad();
			config = new app.models.GameConfig({ _id: self.id, config: self.config });
			return config.saveAsync();
		}
		return true;
	}), app.getServerId())
		.then(() => app.event.emit('transactionSuccess'), () => app.event.emit('transactionFail'));
});

proto._selfLoad = function (config) {
	if (config) {
		this.config = config;
	}
	this.config = this.config || {};
	//彩金抽水
	this.config.caijin_rate = this.config.caijin_rate || 0.8;
	//每局游戏总体时间
	this.config.all_time = this.countdown;//this.config.all_time || 
	//封盘倒计时
	this.config.openSecond = this.config.openSecond || 3000;
	//上庄最小金币数量
	this.config.min_gold = this.config.min_gold || 1000000000;
	//下注金币数量标准
	this.config.down_bet_arr = [10000, 100000, 500000,1000000, 2000000, 5000000, 10000000];//this.config.down_bet_arr || [10000, 100000, 1000000, 10000000, 50000000, 100000000];
	//系统庄时最大下注数量
	this.config.sys_max_down_bet = this.config.sys_max_down_bet || 100000000000;
	//坐椅子最小vip等级
	this.config.seat_vip = this.config.seat_vip || 5;
	//上庄最小vip等级
	this.config.min_vip = this.config.min_vip || 6;
	//系统当庄拿牌概率
	this.config.sys_percent = this.config.sys_percent || [10, 60, 10, 10, 10];
	//玩家当庄拿牌概率
	this.config.player_percent = this.config.player_percent || [5, 20, 25, 40, 10];
	//非vip玩家单注下注上限
	this.config.max_single_bet = 1000000;//this.config.max_single_bet || 
	//抽水比例
	this.config.rate = this.config.rate || 0.05;
};

proto.configGameAsync = P.coroutine(function* (config) {
	var checkValue = function (carr) {
		var arr = _.clone(carr);
		if (typeof arr[0] == 'object') {
			arr = _.map(arr, function (n) { return n.value });
		}
		arr = _.map(arr, function (n) { return (n <= 0 || n >= 100) ? (-50) : n });
		return _.sum(arr) == 100;
	}
	var checkStrArr = ['sys_percent', 'player_percent'];
	for (var i = 0; i < checkStrArr.length; i++) {
		if (!checkValue(config[checkStrArr[i]])) return false;
	}
	var GameConfig = yield this.app.models.GameConfig.findByIdAsync(this.id);
	GameConfig.config = config;
	GameConfig.markModified('config');
	yield GameConfig.saveAsync();
	this.config = config;
	return true;
});

// 游戏开奖
proto._genResultAsync = P.coroutine(function* () {
	var self = this;
	var app = self.app;
	var transData = null;
	var gold = 0;
	return app.memdb.goose.transactionAsync(P.coroutine(function* () {
		var gamebets = yield app.models.GoldenGame.findByIdAsync(self.id);
		if (gamebets) {
			gamebets.result = self._calcResult(gamebets);
			gamebets.markModified('result');
			if (gamebets.banker != '0') {
				let player = yield app.models.Player.findByIdAsync(gamebets.banker);
				if (player) {
					let win = self._bankerWin(gamebets);
					let wateRate = self.config.rate;
					if ((player.wateInvalid > Date.now() || player.wateInvalid == -1) && player.wateRate >= 0 && player.wateRate < wateRate) {
						wateRate = player.wateRate;
					}
					// 抽水
					let real = win > 0 ? Math.floor(win * (1 - wateRate)) : win;
					if (player.gold + real <= 0) {
						gamebets.bankCount = 0;
						player.gold = 0;
					} else {
						gamebets.bankCount -= 1;
						player.gold += real;
					}
					// 彩金池
					if (win > 0) {
						gamebets.gift += Math.floor((win - real) * 0.8);
					}
					// 接受下注上限
					gold = player.gold/3;
					yield player.saveAsync();
					transData = { ids: [gamebets.banker], type: H.dobanker };
				}
			} else {
				let win1 = self._bankerWin(gamebets);
				let real1 = win1 > 0 ? Math.floor(win1 * (1 - gamebets.rate)) : win1;
				if (win1 > 0) {
					gamebets.gift += Math.floor((win1 - real1) * 0.8);
				}
				gold = 100000000000;
			}
			return gamebets.saveAsync();
		}
	}), app.getServerId())
		.then(() => app.event.emit('transactionSuccess'), () => app.event.emit('transactionFail'))
		.then(() => {
			return P.promisify(function (gold, cb) {
				let betsRemote = self.app.rpc.checker.betsRemote.resetniuniu;
				return betsRemote.toServer('bets-check-server', gold, cb);
			})(gold);
		})
		.then(() => {
			if (transData) {
				let hallRemote = self.app.rpc.hall.hallRemote;
				return hallRemote.updateTaskStatus(null, transData.ids, transData.type, () => { });
			}
		});
});