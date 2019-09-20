'use strict';

var quick = require('quick-pomelo');
var P = quick.Promise;
var _ = require('lodash');
var C = require('../../share/constant');
var H = require('../../share/const').TASK_TYPE;
var logger = quick.logger.getLogger('_animal', __filename);

// 构造方法
var Controller = function (app) {
	this.app = app;
	this.id = 10001;
	this.startTime = 0;
	this.betSecond = 28000;
	this.openSecond = 3000;
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
			'2': [[0.05, 0.1], [0.7]],
			'3': [[0.05, 0.1], [0.3]],
			'5': [[0.95, 0.9], [0.45, 0.55], [0.3, 0.5]],
			'6': [[0.95, 0.9], [0.45, 0.55], [0.2]],
			'7': [[0.95, 0.9], [0.45, 0.55], [0.2]],
			'8': [[0.95, 0.9], [0.45, 0.55], [0.3, 0.1]],
			'9': [[0.95, 0.9], [0.55, 0.45], [0.3, 0.1]],
			'10': [[0.95, 0.9], [0.55, 0.45], [0.2]],
			'11': [[0.95, 0.9], [0.55, 0.45], [0.2]],
			'12': [[0.95, 0.9], [0.55, 0.45], [0.3, 0.5]]
		},
		rate: 0.05,
		betLimit: {
			vip: 1,
			max: 10000,
			omx: 1000000
		}
	};
	if (app.getServerType() == '_animal') {
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
			gamebets.bets = [
				{ _id: 1, typeId: 0, mul: 2, count: 0, bet: 0 },			// 鸟类
				{ _id: 2, typeId: 0, mul: 24, count: 0, bet: 0 },			// 银鲨
				{ _id: 3, typeId: 0, mul: 48, count: 0, bet: 0 },			// 金鲨
				{ _id: 4, typeId: 0, mul: 2, count: 0, bet: 0 },			// 兽类
				{ _id: 5, typeId: 1, mul: 6, count: 0, bet: 0 },			// 鸟1
				{ _id: 6, typeId: 1, mul: 8, count: 0, bet: 0 },			// 鸟2
				{ _id: 7, typeId: 1, mul: 8, count: 0, bet: 0 },			// 鸟3
				{ _id: 8, typeId: 1, mul: 12, count: 0, bet: 0 },			// 鸟4
				{ _id: 9, typeId: 4, mul: 12, count: 0, bet: 0 },			// 兽1
				{ _id: 10, typeId: 4, mul: 8, count: 0, bet: 0 },			// 兽2
				{ _id: 11, typeId: 4, mul: 8, count: 0, bet: 0 },			// 兽3
				{ _id: 12, typeId: 4, mul: 6, count: 0, bet: 0 }			// 兽4
			];
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
		var gameServers = this.app.getServersByType('animal');
		var serverCount = 0;
		let animalRemote = this.app.rpc.animal.animalRemote;
		return animalRemote.configGame.toServer('*', {
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

	var configs;
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
		try {
			for (let i = 0; i < 8; ++i) {
				let num = Number(i).toString(2);
				let nms = ('000'.substr(0, 3 - num.length) + num).split('');
				let conds = nms.map((n) => Number(n));
				let rands = {};
				for (let id in configs) {
					let config = configs[id];
					for (let i = 0; i < config.length; ++i) {
						let item = config[i];
						let cond = conds[i];
						rands[id] = rands[id] || 1;
						rands[id] *= item[cond] || item[0];
					}
				}
				var total = 0;
				for (let at in rands) {
					if (rands[at] < 0 || rands[at] > 1) return false;
					total += rands[at];
				}
				if (Math.abs(total - 1) > 1e-6) return false;
			}
		}
		catch (err) {
			return false;
		}
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
	var gameServers = this.app.getServersByType('animal');
	var serverCount = 0;
	var animalRemote = this.app.rpc.animal.animalRemote;
	return animalRemote.startGame.toServer('*', this.startTime, () => {
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
	var gameServers = this.app.getServersByType('animal');
	var serverCount = 0;
	var animalRemote = this.app.rpc.animal.animalRemote;
	return animalRemote.endGame.toServer('*', () => {
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
			for (let i of gamebets.bets) {
				i.bet = 0;
				i.count = 0;
			}
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
	var conds = [0, 0, 0];	// 三个条件
	var count = [0, 0, 0];	// 金银鲨，飞禽，走兽
	var bets = gamebets.bets;
	for (let bet in bets) {
		if (bet._id == 2 || bet._id == 3) {
			count[0] += bet.bet;
		}
		else if (bet.typeId == 1) {
			count[1] += bet.bet;
		}
		else if (bet.typeId == 4) {
			count[2] += bet.bet;
		}
	}
	if (count[0] < count[1] + count[2]) {
		conds[0] = 1;
	}
	if (count[1] < count[2]) {
		conds[1] = 1;
	}
	if (gamebets.banker == '0') {
		conds[2] = 1;
	}
	// 计算概率
	var rands = {};
	var configs = this.gameConfig.configs;
	for (let id in configs) {
		let config = configs[id];
		for (let i = 0; i < config.length; ++i) {
			let item = config[i];
			let cond = conds[i];
			rands[id] = rands[id] || 1;
			rands[id] *= item[cond] || item[0];
		}
	}
	// 产生结果
	var rand = Math.random();
	var sum = 0;
	for (let id in rands) {
		sum += rands[id];
		if (sum >= rand) {
			return Number(id);
		}
	}
	var values = [2, 3];
	values = values.concat(_.range(5, 13));
	return _.sample(values);
};

// 庄家输赢
proto._bankerWin = function (gamebets) {
	var win = 0;
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
					var gameServers = self.app.getServersByType('animal');
					var serverCount = 0;
					let animalRemote = self.app.rpc.animal.animalRemote;
					return animalRemote.changeBanker.toServer('*', data.banker, data.bankCount, data.pos, () => {
						serverCount += 1;
						if (serverCount >= gameServers.length) {
							return cb();
						}
					});
				})();
			}
		});
});

