'use strict';

var quick = require('quick-pomelo');
var P = quick.Promise;
var _ = require('lodash');
var C = require('../../share/constant');
var H = require('../../share/const').TASK_TYPE;
var logger = quick.logger.getLogger('_fruit', __filename);

// 构造方法
var Controller = function (app) {
	this.app = app;
	this.id = 10006;
	this.startTime = 0;
	this.betSecond = 20000;
	this.openSecond = 3000;
	this.bets = [
		{ _id: 1, typeId: 0, mul: 100, count: 0, bet: 0 },			// 水果1
		{ _id: 2, typeId: 0, mul: 50, count: 0, bet: 0 },			// 水果2
		{ _id: 3, typeId: 0, mul: 20, count: 0, bet: 0 },			// 水果3
		{ _id: 4, typeId: 0, mul: 15, count: 0, bet: 0 },			// 水果4
		{ _id: 5, typeId: 0, mul: 8, count: 0, bet: 0 },			// 水果5
		{ _id: 6, typeId: 0, mul: 5, count: 0, bet: 0 },			// 水果6
		{ _id: 7, typeId: 0, mul: 3, count: 0, bet: 0 },			// 水果7
		{ _id: 8, typeId: 0, mul: 2, count: 0, bet: 0 },			// 水果8
		{ _id: 9, typeId: 0, mul: 0, count: 0, bet: 0 },			// 水果9
	];
	this.gameConfig = {
		bankMin: 200000000,
		bankCount: 10,
		rectCount: 10,
		gift: {
			rate: 0.8,
			min: 10000,
			rand: 0.01,
			present: 0.001
		},
		configs: {
			'1': 100,
			'2': 100,
			'3': 100,
			'4': 100,
			'5': 100,
			'6': 100,
			'7': 100,
			'8': 100,
			'9': 200
		},
		rate: 0.05,
		betLimit: {
			vip: 1,
			max: 10000,
			omx: 10000
		}
	};
	if (app.getServerType() == '_fruit') {
		app.event.on('start_all', () => {
			return this._initAsync()
				.then(() => this._configGameAsync())
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

// 初始化
proto._initAsync = P.coroutine(function* () {
	var self = this;
	var app = self.app;
	return app.memdb.goose.transactionAsync(P.coroutine(function* () {
		var gamebets = yield self.app.models.Gamebets.findByIdAsync(self.id);
		if (gamebets) {
			gamebets.banker = '0';
			gamebets.bankers = [];
			gamebets.bankCount = self.gameConfig.bankCount;
		}
		else {
			gamebets = new self.app.models.Gamebets({ _id: self.id });
			gamebets.bets = self.bets;
		}
		yield gamebets.saveAsync();
		var gameConfig = yield self.app.models.GameConfig.findByIdReadOnlyAsync(self.id);
		if (!gameConfig) {
			gameConfig = new self.app.models.GameConfig({ _id: self.id, config: self.gameConfig });
			return gameConfig.saveAsync();
		}
		else {
			for (let at in self.gameConfig) {
				if (gameConfig.config[at]) {
					self.gameConfig[at] = gameConfig.config[at];
				}
			}
		}
	}), app.getServerId())
		.then(() => app.event.emit('transactionSuccess'), () => app.event.emit('transactionFail'));
});

// 配置游戏
proto._configGameAsync = function () {
	return P.promisify((cb) => {
		var gameServers = this.app.getServersByType('fruit');
		var serverCount = 0;
		let fruitRemote = this.app.rpc.fruit.fruitRemote;
		return fruitRemote.configGame.toServer('*', {
			wateRate: this.gameConfig.rate,
			bankMin: this.gameConfig.bankMin,
			giftRate: this.gameConfig.gift.rate,
			maxVip: this.gameConfig.betLimit.vip,
			maxBet: this.gameConfig.betLimit.max,
			oneMax: this.gameConfig.betLimit.omx
		}, () => {
			serverCount += 1;
			if (serverCount >= gameServers.length) {
				return cb();
			}
		});
	})();
};

// 校验数据
proto._checkValid = function (gameConfig) {
	const g0l1 = ['gift.rate', 'gift.rand', 'gift.present', 'rate'];
	const gtr0 = ['bankMin', 'bankCount', 'rectCount', 'gift.min', 'betLimit.vip', 'betLimit.max', 'betLimit.omx'];

	var configs = null;
	var objs = {};
	for (let at in gameConfig) {
		let val = gameConfig[at];
		if (typeof val == 'object') {
			if (at == 'configs') {
				configs = val;
			}
			else objs[at] = val;
			continue;
		}
		let i = g0l1.indexOf(at);
		if (-1 != i && (gameConfig[at] < 0 || gameConfig[at] > 1)) return false;
		let j = gtr0.indexOf(at);
		if (-1 != j && gameConfig[at] <= 0) return false;
	}
	for (let at0 in objs) {
		let obj = objs[at0];
		for (let at1 in obj) {
			let i = g0l1.indexOf(at0 + '.' + at1);
			if (-1 != i && (obj[at1] < 0 || obj[at1] > 1)) return false;
			let j = gtr0.indexOf(at0 + '.' + at1);
			if (-1 != j && obj[at1] <= 0) return false;
		}
	}
	if (configs) {
		let sum = 0;
		Object.keys(configs).forEach((at) => { sum += configs[at]; });
		return (sum == 1000);
	}
	return true;
};

// 配置游戏
proto.configGameAsync = P.coroutine(function* (gameConfig) {
	if (!this._checkValid(gameConfig)) {
		return;
	}
	var self = this;
	var app = self.app;
	return app.memdb.goose.transactionAsync(P.coroutine(function* () {
		var gc = yield self.app.models.GameConfig.findByIdAsync(self.id);
		for (let at in self.gameConfig) {
			if (gameConfig[at]) {
				self.gameConfig[at] = gameConfig[at];
				gc.config[at] = gameConfig[at];
			}
		}
		gc.markModified('config');
		return gc.saveAsync();
	}), app.getServerId())
		.then(() => app.event.emit('transactionSuccess'), () => app.event.emit('transactionFail'))
		.then(() => this._configGameAsync());
});

// 开始游戏
proto._startGameAsync = P.coroutine(function* () {
	yield this._resetAsync();
	var gameServers = this.app.getServersByType('fruit');
	var serverCount = 0;
	var fruitRemote = this.app.rpc.fruit.fruitRemote;
	return fruitRemote.startGame.toServer('*', this.startTime, () => {
		serverCount += 1;
		if (serverCount >= gameServers.length) {
			var endTime = this.startTime + this.betSecond + this.openSecond;
			return setTimeout(() => this._endGameAsync(), endTime - Date.now());
		}
	});
});

// 结束游戏
proto._endGameAsync = P.coroutine(function* () {
	var self = this;
	var app = self.app;
	yield this._genResultAsync();
	var gameServers = this.app.getServersByType('fruit');
	var serverCount = 0;
	var fruitRemote = this.app.rpc.fruit.fruitRemote;
	return fruitRemote.endGame.toServer('*', () => {
		serverCount += 1;
		if (serverCount >= gameServers.length) {
			return app.memdb.goose.transactionAsync(P.coroutine(function* () {
				return self._recordAsync();
			}), app.getServerId())
				.then(() => app.event.emit('transactionSuccess'), () => app.event.emit('transactionFail'))
				.then(() => this._nextBankerAsync())
				.then(() => this._startGameAsync());
		}
	});
});

// 重置数据
proto._resetAsync = P.coroutine(function* () {
	var self = this;
	var app = self.app;
	this.startTime = Date.now();
	return app.memdb.goose.transactionAsync(P.coroutine(function* () {
		var gamebets = yield self.app.models.Gamebets.findByIdAsync(self.id);
		if (gamebets) {
			// 最近走势
			let recent = gamebets.recent;
			if (gamebets.result) {
				recent.push(gamebets.result);
				if (recent.length > self.gameConfig.rectCount) {
					recent.splice(0, 1);
				}
			}
			// 清空下注
			gamebets.result = 0;
			gamebets.bets = self.bets;
			gamebets.rate = self.gameConfig.rate;
			gamebets.startTime = self.startTime;
			gamebets.markModified('bets');
		}
		return gamebets.saveAsync();
	}), app.getServerId())
		.then(() => app.event.emit('transactionSuccess'), () => app.event.emit('transactionFail'));
});

// 游戏记录
proto._recordAsync = P.coroutine(function* () {
	var gamerecord = new this.app.models.GameRecord({ _id: Date.now(), gameId: this.id });
	var gamebets = yield this.app.models.Gamebets.findByIdReadOnlyAsync(this.id);
	if (gamebets) {
		gamerecord.bets = gamebets.bets;
		gamerecord.result = gamebets.result;
		gamerecord.gift = gamebets.gift;
		if (_.findIndex(gamerecord.bets, (i) => (i.bet > 0)) != -1) {
			gamerecord.markModified('bets');
			return gamerecord.saveAsync();
		}
	}
});

// 计算开奖
proto._calcResult = function (gamebets) {
	var rand = _.random(0, 999);
	var sum = 0;
	var configs = this.gameConfig.configs;
	for (let id in configs) {
		sum += configs[id];
		if (rand < sum) {
			return Number(id);
		}
	}
	var values = _.range(1, 10);
	return _.sample(values);
};

// 庄家输赢
proto._bankerWin = function (gamebets) {
	var win = 0;
	if (gamebets.result == 9) return win;
	var ret = _.find(gamebets.bets, { _id: gamebets.result });
	if (ret) {
		let typeBet = _.find(gamebets.bets, { _id: ret.typeId });
		for (let i of gamebets.bets) {
			win += i.bet;
			if (i._id == ret._id) {
				win -= i.bet * i.mul;
			}
			if (typeBet && i._id == typeBet._id) {
				win -= i.bet * i.mul;
			}
		}
	}
	return win;
};

// 游戏开奖
proto._genResultAsync = P.coroutine(function* () {
	var data = null;
	var self = this;
	var app = self.app;
	return app.memdb.goose.transactionAsync(P.coroutine(function* () {
		var gamebets = yield app.models.Gamebets.findByIdAsync(self.id);
		if (gamebets) {
			// 计算开奖
			gamebets.result = self._calcResult(gamebets);
			gamebets.present = 0;
			// 计算彩金
			let winCount = 0;
			let winBet = _.find(gamebets.bets, { _id: gamebets.result });
			if (winBet) {
				winCount += winBet.count;
				let typeBet = _.find(gamebets.bets, { _id: winBet.typeId });
				if (typeBet) {
					winCount += typeBet.count;
				}
			}
			if (gamebets.gift >= self.gameConfig.gift.min) {
				let rand = Math.random();
				if (rand < self.gameConfig.gift.rand && winCount > 0) {
					gamebets.present = Math.floor(gamebets.gift * self.gameConfig.gift.present / winCount);
					gamebets.gift -= gamebets.present * winCount;
				}
			}
			// 庄家结算
			if (gamebets.banker != '0') {
				let player = yield self.app.models.Player.findByIdAsync(gamebets.banker);
				if (player) {
					let win = self._bankerWin(gamebets);
					// 抽水
					let wateRate = self.gameConfig.rate;
					if ((player.wateInvalid > Date.now() || player.wateInvalid == -1) && player.wateRate >= 0 && player.wateRate < wateRate) {
						wateRate = player.wateRate;
					}
					let real = win > 0 ? Math.floor(win * (1 - wateRate)) : win;
					if (player.gold + real <= 0) {
						gamebets.bankCount = 0;
						player.gold = 0;
					}
					else {
						gamebets.bankCount -= 1;
						player.gold += real;
					}
					// 彩金池
					if (win > 0) {
						gamebets.gift += Math.floor((win - real) * self.gameConfig.gift.rate);
					}
					yield player.saveAsync();
					data = { ids: [gamebets.banker], type: H.dobanker };
				}
			}
			return gamebets.saveAsync();
		}
	}), app.getServerId())
		.then(() => app.event.emit('transactionSuccess'), () => app.event.emit('transactionFail'))
		.then(() => {
			if (data) {
				let hallRemote = self.app.rpc.hall.hallRemote;
				return hallRemote.updateTaskStatus(null, data.ids, data.type, () => { });
			}
		});
});

// 可用庄家
proto._validBankAsync = P.coroutine(function* (bankers) {
	for (let i = 0; i < bankers.length; ++i) {
		let player = yield this.app.models.Player.findByIdReadOnlyAsync(bankers[i], 'gold');
		if (player && player.gold >= this.gameConfig.bankMin) {
			return { index: i, banker: bankers[i] };
		}
	}
});

// 切换庄家
proto._nextBankerAsync = P.coroutine(function* () {
	var data = null;
	var self = this;
	var app = self.app;
	return app.memdb.goose.transactionAsync(P.coroutine(function* () {
		var gamebets = yield self.app.models.Gamebets.findByIdAsync(self.id);
		var pos = 999;
		if (gamebets.banker == '0') {
			if (gamebets.bankers.length > 0) {
				let bank = yield self._validBankAsync(gamebets.bankers);
				if (bank) {
					gamebets.banker = bank.banker;
					gamebets.bankers.splice(bank.index, 1);
					gamebets.bankCount = self.gameConfig.bankCount;
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
			else gamebets.banker = '0';
			gamebets.bankCount = self.gameConfig.bankCount;
		}
		if (gamebets.isModified()) {
			yield gamebets.saveAsync();
			data = { banker: gamebets.banker, bankCount: gamebets.bankCount, pos: pos };
		}
	}), app.getServerId())
		.then(() => app.event.emit('transactionSuccess'), () => app.event.emit('transactionFail'))
		.then(() => {
			if (data) {
				return P.promisify((cb) => {
					var gameServers = self.app.getServersByType('fruit');
					var serverCount = 0;
					let fruitRemote = self.app.rpc.fruit.fruitRemote;
					return fruitRemote.changeBanker.toServer('*', data.banker, data.bankCount, data.pos, () => {
						serverCount += 1;
						if (serverCount >= gameServers.length) {
							return cb();
						}
					});
				})();
			}
		});
});

