'use strict';

var quick = require('quick-pomelo');
var P = quick.Promise;
var _ = require('lodash');
var uuid = require('node-uuid');
var http = require('http');
var url = require('url');
var md5 = require('md5');
var qs = require('querystring');
var logger = quick.logger.getLogger('datServer', __filename);

// 处理器
var handler = {};

// 内存数据
var datamem = {};

// 导出方法
module.exports = function (app) {
	handler.app = app;
	var server = http.createServer(handler.handle);
	var port = app.getCurServer().httpPort;
	server.listen(port);
	handler.uptime = Date.now();
};

// 主处理
handler.handle = function (req, res) {
	var pathname = url.parse(req.url).pathname;
	if (!route[pathname]) {
		res.writeHead(404, {
			'Content-Type': 'text/plain;charset=utf-8',
			"Access-Control-Allow-Origin": "*",
			"Access-Control-Allow-Headers": "X-Requested-With",
			"Access-Control-Allow-Methods": "PUT,POST,GET,DELETE,OPTIONS"
		});
		res.write('WARNING: Not Found!');
		res.end();
	}
	else {
		res.writeHead(200, {
			'Content-Type': 'text/plain;charset=utf-8',
			"Access-Control-Allow-Origin": "*",
			"Access-Control-Allow-Headers": "X-Requested-With",
			"Access-Control-Allow-Methods": "PUT,POST,GET,DELETE,OPTIONS"
		});
		if (req.method.toLowerCase() == 'get') {
			let query = url.parse(req.url, true).query;
			logger.info('pathname: %s, method: %s, query: %j', pathname, req.method, query);
			return route[pathname](query, req.method, res);
		}
		else if (req.method.toLowerCase() == 'post') {
			let postData = '';
			req.on('data', function (data) {
				postData += data;
			});
			req.on('end', function () {
				let query = {};
				if (/^\s*{.*:.*}\s*$/.test(postData)) {
					query = JSON.parse(postData);
				}
				else {
					query = qs.parse(postData);
				}
				logger.info('pathname: %s, method: %s, query: %j', pathname, req.method, query);
				return route[pathname](query, req.method, res);
			});
		}
	}
};

// 写出数据
var writeOut = function (query, res) {
	if (typeof query != 'object') {
		return res.end(String(query));
	}
	return res.end(JSON.stringify(query));
};

// 查询接口
var select = function (query, method, res) {
	var keys = Object.keys(query);
	if (keys.length <= 0) {
		return writeOut('fail', res);
	}
	var method = query['method'];
	switch (method) {
		case 'all':
			return handler.allPlayerdAsync(res, query);
		case 'add':
			return handler.addPlayerAsync(res, query);
		case 'again':
			return handler.againPlayerAsync(res, query);
		case 'online':
			return handler.onlinePlayerAsync(res, query);
		case 'recharge':
			return handler.rechargePlayerAsync(res, query);
	}
	return writeOut('fail', res);
};

// 单页记录数
const PAGE_SIZE = 20;

// 查询条件
var genCondition = function (query) {
	var result = { limit: PAGE_SIZE };
	var account = query.account;
	if (!account) {
		let page = Math.round(Number(query.p) || 1);
		page = page > 0 ? page : 1;
		result.skip = (page - 1) * PAGE_SIZE;
	}
	return result;
};

// 所有玩家
handler.allPlayerdAsync = P.coroutine(function* (res, query) {
	var app = this.app;
	var pre = query.pre || 'my2016';
	return app.memdb.goose.transactionAsync(P.coroutine(function* () {
		var opts = (query.account && { account: query.account }) || {};
		// opts._id = new RegExp('@' + pre + '$');
		var count = yield app.models.Player.countMongoAsync(opts);
		var opti = genCondition(query);
		opti.sort = ['-registerTime'];
		console.warn(opti,count);
		var players = yield app.models.Player.findMongoAsync(opts, 'account name vip gold totalMoney lastLoginTime registerTime registerIp lastLoginIp', opti);
		return writeOut({ count: count, list: players }, res);
	}), app.getServerId())
		.then(() => app.event.emit('transactionSuccess'), () => app.event.emit('transactionFail'));
});

// 今日新增
handler.addPlayerAsync = P.coroutine(function* (res, query) {
	var app = this.app;
	var pre = query.pre || 'my2016';
	var today = new Date();
	today.setMilliseconds(0);
	today.setSeconds(0);
	today.setMinutes(0);
	today.setHours(0);
	return app.memdb.goose.transactionAsync(P.coroutine(function* () {
		var opts = { registerTime: { $gte: today.getTime() } };
		if (query.account) {
			opts.account = query.account;
		}
		// opts._id = new RegExp('@' + pre + '$');
		var opti = genCondition(query);
		opti.sort = ['-registerTime'];
		var count = yield app.models.Player.countMongoAsync(opts);
		var players = yield app.models.Player.findMongoAsync(opts, 'account name vip gold totalMoney lastLoginTime registerTime registerIp lastLoginIp', opti);
		return writeOut({ count: count, list: players }, res);
	}), app.getServerId())
		.then(() => app.event.emit('transactionSuccess'), () => app.event.emit('transactionFail'));
});

// 昨日留存
handler.againPlayerAsync = P.coroutine(function* (res, query) {
	var app = this.app;
	var pre = query.pre || 'my2016';
	var today = new Date();
	today.setMilliseconds(0);
	today.setSeconds(0);
	today.setMinutes(0);
	today.setHours(0);
	var yest = new Date(today.getTime() - 86400000);
	return app.memdb.goose.transactionAsync(P.coroutine(function* () {
		var opts = {
			registerTime: {
				$gte: yest.getTime(),
				$lt: today.getTime()
			},
			lastLoginTime: {
				$gte: today.getTime()
			}
		};
		if (query.account) {
			opts.account = query.account;
		}
		// opts._id = new RegExp('@' + pre + '$');
		var opti = genCondition(query);
		opti.sort = ['-lastLoginTime'];
		var count = yield app.models.Player.countMongoAsync(opts);
		var players = yield app.models.Player.findMongoAsync(opts, 'account name vip gold totalMoney lastLoginTime registerTime registerIp lastLoginIp', opti);
		return writeOut({ count: count, list: players }, res);
	}), app.getServerId())
		.then(() => app.event.emit('transactionSuccess'), () => app.event.emit('transactionFail'));
});

// 在线玩家
handler.onlinePlayerAsync = P.coroutine(function* (res, query) {
	var self = this;
	var app = this.app;
	var pre = query.pre || 'my2016';
	return app.memdb.goose.transactionAsync(P.coroutine(function* () {
		var opts = {
			connectorId: {
				$ne: ''
			},
			lastLoginTime: {
				$gt: self.uptime
			}
		};
		if (query.account) {
			opts.account = query.account;
		}
		// opts._id = new RegExp('@' + pre + '$');
		var opti = genCondition(query);
		opti.sort = ['-lastLoginTime'];
		var count = yield app.models.Player.countMongoAsync(opts);
		var players = yield app.models.Player.findMongoAsync(opts, 'account name vip gold totalMoney lastLoginTime registerTime registerIp lastLoginIp', opti);
		return writeOut({ count: count, list: players }, res);
	}), app.getServerId())
		.then(() => app.event.emit('transactionSuccess'), () => app.event.emit('transactionFail'));
});

var formatTime = function (timestamp) {
	var a = new Date();
	a.setTime(timestamp || Date.now());
	var y = a.getFullYear(), m = a.getMonth() + 1, d = a.getDate();
	return Date.parse([y, m, d].join('-') + ' 00:00:00');
};

// 充值玩家
handler.rechargePlayerAsync = P.coroutine(function* (res, query) {
	var app = this.app;
	var pre = query.pre || 'my2016';
	var pre_obj = {
		'my2016': 'hz_',
		'baidu': 'bd_',
		'jiuyaowan': 'nop_',
		'youxidou': 'yxd_',
		'qunhei': 'qh_'
	};
	return app.memdb.goose.transactionAsync(P.coroutine(function* () {
		var opts = {
			totalMoney: {
				$gt: 0
			}
		};
		if (query.account) {
			opts.account = query.account;
		}
		// opts._id = new RegExp('@' + pre + '$');
		var opti = genCondition(query);
		opti.sort = ['-lastLoginTime'];
		var count = yield app.models.Player.countMongoAsync(opts);
		var players = yield app.models.Player.findMongoAsync(opts, 'account name vip gold totalMoney lastLoginTime registerTime registerIp lastLoginIp', opti);
		var nowTz = formatTime();
		var payReOpt = {};
		// if (JSON.stringify(datamem) == '{}') datamem = { '1492272000000': 0 };
		var memkey = (JSON.stringify(datamem) == '{}') ? 0 : Number(Object.keys(datamem)[0]);
		var payMoney = 0;
		if (nowTz - (60 * 60 * 24 * 1000) == memkey) {
			payMoney = datamem[memkey];
		} else {
			payReOpt.time = { $gte: (memkey == 0) ? 0 : (memkey + (60 * 60 * 24 * 1000)), $lt: nowTz };
			var pdr = yield app.models.PayDayRecord.findMongoAsync(payReOpt, 'total_fee time', { sort: '-time' });
			var lastTime = pdr.length > 0 ? pdr[0].time : 0;
			if (memkey == 0) {
				for (var i in pdr) {
					payMoney += pdr[i].total_fee;
				}
			} else {
				payMoney = datamem[memkey];
			}
			if (lastTime < (nowTz - (60 * 60 * 24 * 1000))) {
				var paySums = yield app.models.PayRecord.findMongoAsync(payReOpt, 'total_fee time', { sort: '-time' });
				var pss = _.clone(paySums);
				if (pdr.length <= 0) {
					pss = _.map(pss, function (n) { n.time = formatTime(n.time); return n; });
					var gps = _.groupBy(pss, 'time');
					for (var i in gps) {
						var tf = _.sumBy(gps[i], 'total_fee');
						payMoney += tf;
						var npdr = new app.models.PayDayRecord({
							_id: String(i),
							time: Number(i),
							total_fee: tf
						});
						yield npdr.saveAsync();
					}
				} else {
					let ruleTime = pdr[0].time;
					pss = _.map(pss, function (n) { n.time = formatTime(n.time); return n; });
					var gps = _.groupBy(pss, 'time');
					for (var i in gps) {
						var tf = _.sumBy(gps[i], 'total_fee');
						if (i > ruleTime) {
							payMoney += tf;
							var npdr = new app.models.PayDayRecord({
								_id: String(i),
								time: Number(i),
								total_fee: tf
							});
							yield npdr.saveAsync();
						}
					}
				}
			}
			datamem = {};
			datamem[nowTz - (60 * 60 * 24 * 1000)] = payMoney;
		}
		return writeOut({ count: count, list: players, money: payMoney }, res);
	}), app.getServerId())
		.then(() => app.event.emit('transactionSuccess'), () => app.event.emit('transactionFail'));
});

// 可配游戏
const gameList = [
	{ id: 10001, name: '金鲨银鲨' },
	{ id: 10002, name: '百人金花' },
	{ id: 10003, name: '百人牛牛' },
	{ id: 10006, name: '水果机' },
	{ id: 20003, name: '小丑' },
	{ id: 10004, name: '21点' }
];

// 获取游戏
var getgame = function (query, method, res) {
	return writeOut(gameList, res);
};

// 获取配置
var getconfig = P.coroutine(function* (query, method, res) {
	var gameId = Number(query.gameid);
	if (-1 != _.findIndex(gameList, { id: gameId })) {
		let self = handler;
		let app = self.app;
		return app.memdb.goose.transactionAsync(P.coroutine(function* () {
			var gameConfig = yield app.models.GameConfig.findByIdAsync(gameId);
			if (gameConfig) {
				return writeOut(gameConfig, res);
			}
			return writeOut('fail', res);
		}), app.getServerId())
			.then(() => app.event.emit('transactionSuccess'), () => app.event.emit('transactionFail'));
	}
});

// 设置配置
var setconfig = P.coroutine(function* (query, method, res) {
	var gameId = Number(query.gameid);
	var self = handler;
	var app = self.app;
	var gameRemote;
	switch (gameId) {
		case 10001:
			gameRemote = app.rpc._animal._animalRemote;
			break;
		case 10006:
			gameRemote = app.rpc._fruit._fruitRemote;
			break;
		case 10002:
			gameRemote = app.rpc._golden._goldenRemote;
			break;
		case 10003:
			gameRemote = app.rpc._niuniu._niuniuRemote;
			break;
		case 10004:
			{
				app.rpc.to.toRemote.configGame.toServer('*', query.config, () => { });
				return writeOut('success', res);
			}
		case 20003:
			{
				app.rpc.clown.clownRemote.configGame.toServer('*', query.config, () => { });
				return writeOut('success', res);
			}
	}
	if (gameRemote) {
		console.warn('query', query);
		gameRemote.configGame(null, query.config, () => { });
		return writeOut('success', res);
	}
	return writeOut('fail', res);
});

// 发送广播
var broadcast = P.coroutine(function* (query, method, res) {
	var msg = query.msg;
	if (msg) {
		if (typeof msg == 'string') msg = '6:' + msg;
		var hallRemote = handler.app.rpc.hall.hallRemote;
		hallRemote.broadcast(null, msg, () => { });
		return writeOut('success', res);
	}
	return writeOut('fail', res);
});

// 上下分
var updownscore = P.coroutine(function* (query, method, res) {
	var account = query.account;
	if (!account) {
		return writeOut('fail', res);
	}
	var gold = Number(query.gold) || 0;
	var pk_ticket = Number(query.pk_ticket) || 0;

	var self = handler;
	var app = self.app;
	return app.memdb.goose.transactionAsync(P.coroutine(function* () {
		var player = yield app.models.Player.findOneAsync({ account: account });
		if (player) {
			player.gold += gold;
			player.pk_ticket += pk_ticket;
			return player.saveAsync()
				.then(() => writeOut('success', res));
		}
		return writeOut('fail', res);
	}), app.getServerId())
		.then(() => app.event.emit('transactionSuccess'), () => app.event.emit('transactionFail'));
});

// 设置抽奖配置
var setawardsconfig = P.coroutine(function* (query, method, res) {
	var self = handler;
	var app = self.app;
	return app.memdb.goose.transactionAsync(P.coroutine(function* () {
		app.controllers.hall.setAwardsConfigAsync(query)
			.then(() => writeOut('success', res));
	}), app.getServerId())
		.then(() => app.event.emit('transactionSuccess'), () => app.event.emit('transactionFail'));
});

// 获取抽奖配置
var getawardsconfig = P.coroutine(function* (query, method, res) {
	var gameId = Number(query.awardsid);
	// if (-1 != _.findIndex(gameList, { id: gameId })) {
	let self = handler;
	let app = self.app;
	return app.memdb.goose.transactionAsync(P.coroutine(function* () {
		var gameConfig = yield app.models.Luckdraw.findByIdAsync('draw');
		if (gameConfig) {
			return writeOut(gameConfig, res);
		}
		return writeOut('fail', res);
	}), app.getServerId())
		.then(() => app.event.emit('transactionSuccess'), () => app.event.emit('transactionFail'));
	// }
});

// 系统发红包
var sysredpack = P.coroutine(function* (query, method, res) {
	var self = handler;
	var app = self.app;
	return app.memdb.goose.transactionAsync(P.coroutine(function* () {
		return app.controllers.hall.webAddPackAsync(query)
			.then(() => writeOut('success', res));
	}), app.getServerId())
		.then(() => app.event.emit('transactionSuccess'), () => app.event.emit('transactionFail'));
});

// 获取建议列表
var getbuglist = P.coroutine(function* (query, method, res) {
	var self = handler;
	var app = self.app;
	return app.memdb.goose.transactionAsync(P.coroutine(function* () {
		var opt = { state: { $gte: 0 } };
		var rule = genCondition(query);
		rule.sort = '-time';
		var count = yield app.models.Proposals.countMongoAsync(opt);
		var players = yield app.models.Proposals.findMongoAsync(opt, 'name time text state', rule);
		return writeOut({ count: count, list: players }, res);
	}), app.getServerId())
		.then(() => app.event.emit('transactionSuccess'), () => app.event.emit('transactionFail'));
});

// 建议采纳发送邮件
var getbug = P.coroutine(function* (query, method, res) {
	var self = handler;
	var app = self.app;
	return app.memdb.goose.transactionAsync(P.coroutine(function* () {
		return app.controllers.hall.getBugAsync(query.id)
			.then(() => writeOut('success', res));
	}), app.getServerId())
		.then(() => app.event.emit('transactionSuccess'), () => app.event.emit('transactionFail'));
});

// 获取大转盘配置
var getDialConfig = P.coroutine(function* (query, method, res) {
	var app = handler.app;
	return app.memdb.goose.transactionAsync(P.coroutine(function* () {
		var opts = {};
		var fortune = yield app.models.SingleData.findByIdAsync('fortune');
		return writeOut(fortune.data, res);
	}), app.getServerId())
		.then(() => app.event.emit('transactionSuccess'), () => app.event.emit('transactionFail'));
});

// 设置大转盘配置
var setDialConfig = P.coroutine(function* (query, method, res) {
	var app = handler.app;
	if (!query['id']) {
		return writeOut('fail', res);
	}
	return app.memdb.goose.transactionAsync(P.coroutine(function* () {
		var opts = {};
		var fortune = yield app.models.SingleData.findByIdAsync('fortune');
		var findex = _.findIndex(fortune.data, function (n) { return n.id == Number(query.id); });
		if (findex != -1) {
			for (var i in fortune.data[findex]) {
				fortune.data[findex][i] = query[i] || fortune.data[findex][i];
			}
		}
		fortune.markModified('data');
		yield fortune.saveAsync();
		return writeOut({ msg: 'success', data: fortune.data }, res);
	}), app.getServerId())
		.then(() => app.event.emit('transactionSuccess'), () => app.event.emit('transactionFail'));
});

// 添加竞猜内容
var setcompetition = P.coroutine(function* (query, method, res) {
	var app = handler.app;
	return app.memdb.goose.transactionAsync(P.coroutine(function* () {
		var cl = new app.models.CompetitionList(
			{
				_id: uuid.v1(),
				begin_time: Number(query['begin_time']),
				end_time: Number(query['end_time']),
				title: query['title'],
				image_url: query['image_url'],
				rate: Number(query['rate']),
				wate_rate: Number(query['wate_rate']) || 0.05,
				answer: [
					{
						_id: 1,
						title: query['answerA'],
						rate: query['rateA']
					},
					{
						_id: 2,
						title: query['answerB'],
						rate: query['rateB'],
					}
				]
			}
		);
		yield cl.saveAsync();
		return writeOut({ msg: 'success' }, res);
	}), app.getServerId())
		.then(() => app.event.emit('transactionSuccess'), () => app.event.emit('transactionFail'));
});

// 获取竞猜内容
var getcompetition = P.coroutine(function* (query, method, res) {
	var app = handler.app;
	return app.memdb.goose.transactionAsync(P.coroutine(function* () {
		var nowTime = Date.now();
		var competitionList = yield app.models.CompetitionList.findMongoAsync({}, 'image_url begin_time end_time answer title', { limit: 10, sort: '-end_time' });
		return writeOut(competitionList, res);
	}), app.getServerId())
		.then(() => app.event.emit('transactionSuccess'), () => app.event.emit('transactionFail'));
});

// 开奖
var opencompe = P.coroutine(function* (query, method, res) {
	var app = handler.app;
	return app.memdb.goose.transactionAsync(P.coroutine(function* () {
		var nowTime = Date.now();
		var cpp = yield app.models.CompetitionList.findByIdAsync(query['id']);
		if (!cpp) return writeOut('fail', res);
		var nowTime = Date.now();
		if (cp.end_time > nowTime) return writeOut('fail', res);
		var cp = cpp._doc;
		var cprr = {};
		for (var i in cp) {
			cprr[i] = cp[i];
		}
		cprr.result = Number(query['cr']);
		var cpr = new app.models.CompetitionListRecord(cprr);
		yield cpr.saveAsync();
		yield cpp.removeAsync();
		return writeOut('success', res);
	}), app.getServerId())
		.then(() => app.event.emit('transactionSuccess'), () => app.event.emit('transactionFail'));
});

// 获取兑换奖品列表
var getgiftslist = P.coroutine(function* (query, method, res) {
	var app = handler.app;
	return app.memdb.goose.transactionAsync(P.coroutine(function* () {
		var competitionList = yield app.models.Gift.findByIdAsync('gift');
		return writeOut(competitionList.gifts, res);
	}), app.getServerId())
		.then(() => app.event.emit('transactionSuccess'), () => app.event.emit('transactionFail'));
});

// 兑换奖品记录
var getExchangeRecord = P.coroutine(function* (query, method, res) {
	var app = handler.app;
	return app.memdb.goose.transactionAsync(P.coroutine(function* () {
		var opts = {};
		var ruleQ = genCondition(query);
		ruleQ.sort = '-exchange_time';
		var count = yield app.models.Exchangerecord.countMongoAsync(opts);
		var exchangeRecords = yield app.models.Exchangerecord.findMongoAsync(opts, null, ruleQ);
		for (var i in exchangeRecords) {
			var ai = yield app.models.Address.findByIdReadOnlyAsync(exchangeRecords[i].playerId);
			if (ai) {
				exchangeRecords[i].address = ai.address;
			}
		}
		return writeOut({ count: count, list: exchangeRecords }, res);
	}), app.getServerId())
		.then(() => app.event.emit('transactionSuccess'), () => app.event.emit('transactionFail'));
});

// 提现记录
var getMoneyList = P.coroutine(function* (query, method, res) {
	var app = handler.app;
	return app.memdb.goose.transactionAsync(P.coroutine(function* () {
		var opts = {};
		var ruleQ = genCondition(query);
		// ruleQ.sort = '-exchange_time';
		var count = yield app.models.ExchangeRecord.countMongoAsync(opts);
		var exchangeRecords = yield app.models.ExchangeRecord.findMongoAsync(opts, null, ruleQ);
		return writeOut({ count: count, list: exchangeRecords }, res);
	}), app.getServerId())
		.then(() => app.event.emit('transactionSuccess'), () => app.event.emit('transactionFail'));
});

//发货
var sendGift = P.coroutine(function* (query, method, res) {
	var app = handler.app;
	if (!query['exchangeId']) {
		return writeOut('fail', res);
	}
	return app.memdb.goose.transactionAsync(P.coroutine(function* () {
		var exchangeR = yield app.models.Exchangerecord.findByIdAsync(query['exchangeId']);
		if (exchangeR) {
			var ai = yield this.app.models.Address.findByIdReadOnlyAsync(exchangeR.playerId);
			if (ai) {
				exchangeR.status = 2;
				yield exchangeR.saveAsync();
				return writeOut('success', res);
			}
			return writeOut('fail', res);
		}
		return writeOut('fail', res);
	}), app.getServerId())
		.then(() => app.event.emit('transactionSuccess'), () => app.event.emit('transactionFail'));
});

// 设置兑换奖品
var setgiftconfig = P.coroutine(function* (query, method, res) {
	var app = handler.app;
	var giftId = query['id'];
	if (!giftId) return writeOut('fail', res);
	return app.memdb.goose.transactionAsync(P.coroutine(function* () {
		var competitionList = yield app.models.Gift.findByIdAsync('gift');
		var sg = competitionList.gifts.id(Number(giftId));
		for (var i in sg) {
			sg[i] = query[i] || sg[i];
		}
		yield competitionList.saveAsync();
		return writeOut('success', res);
	}), app.getServerId())
		.then(() => app.event.emit('transactionSuccess'), () => app.event.emit('transactionFail'));
});

// 获得账号
var getaccount = P.coroutine(function* (query, method, res) {
	var dat = { code: -1 };
	if (!query['userid']) {
		dat.msg = 'Invalid userid!';
		return writeOut(dat, res);
	}
	var app = handler.app;
	return app.memdb.goose.transactionAsync(P.coroutine(function* () {
		var player = yield app.models.Player.findByIdReadOnlyAsync(query['userid'], 'account');
		if (player) {
			dat.code = 0;
			dat.account = player.account;
		} else {
			dat.msg = 'User not found!';
		}
		return writeOut(dat, res);
	}), app.getServerId())
		.then(() => app.event.emit('transactionSuccess'), () => app.event.emit('transactionFail'));
});

// 离开斗地主
var leaveddz = P.coroutine(function* (query, method, res) {
	if (!query['account']) {
		return writeOut('fail', res);
	}
	var account = query['account'];
	var app = handler.app;
	var player = yield app.memdb.goose.transactionAsync(() => {
		return app.models.Player.findOneReadOnlyAsync({ account: account }, '_id gameServerId');
	}, app.getServerId());
	if (!player) return writeOut('fail', res);
	app.rpc.ddz.ddzRemote.leaveGame.toServer(player.gameServerId, player._id, () => {
		console.warn('http leave ddz game: ', player._id);
	});
	return writeOut('success', res);
});

var getcrl = P.coroutine(function* (query, method, res) {
	var app = handler.app;
	return app.memdb.goose.transactionAsync(P.coroutine(function* () {
		var mrps = yield app.models.MoneyRedPackRecord.findMongoAsync({}, genCondition(query));
		return writeOut(mrps, res);
	}), app.getServerId())
		.then(() => app.event.emit('transactionSuccess'), () => app.event.emit('transactionFail'));
});

var setFreeze = P.coroutine(function* (query, method, res) {
	var app = handler.app;
	return app.memdb.goose.transactionAsync(P.coroutine(function* () {
		var mrps = yield app.models.Player.findByIdAsync(query['playerId'], 'frozen');
		mrps.frozen = 1;
		yield mrps.saveAsync();
		return writeOut('success', res);
	}), app.getServerId())
		.then(() => app.event.emit('transactionSuccess'), () => app.event.emit('transactionFail'));
});

var jcFreeze = P.coroutine(function* (query, method, res) {
	var app = handler.app;
	return app.memdb.goose.transactionAsync(P.coroutine(function* () {
		var mrps = yield app.models.Player.findByIdAsync(query['playerId'], 'frozen');
		mrps.frozen = 0;
		yield mrps.saveAsync();
		return writeOut('success', res);
	}), app.getServerId())
		.then(() => app.event.emit('transactionSuccess'), () => app.event.emit('transactionFail'));
});

// 消息路由
var route = {
	'/select.nd': select,
	'/getgame.nd': getgame,
	'/getconfig.nd': getconfig,
	'/setconfig.nd': setconfig,
	'/broadcast.nd': broadcast,
	'/addgold.nd': updownscore,
	'/sysredpack.nd': sysredpack,
	'/setawardsconfig.nd': setawardsconfig,
	'/getawardsconfig.nd': getawardsconfig,
	'/getbuglist.nd': getbuglist,
	'/getbug.nd': getbug,
	'/getDialConfig.nd': getDialConfig,
	'/setDialConfig.nd': setDialConfig,
	'/getExchangeRecord.nd': getExchangeRecord,
	'/setcompetition.nd': setcompetition,
	'/getcompetition.nd': getcompetition,
	'/opencompe.nd': opencompe,
	'/getgiftslist.nd': getgiftslist,
	'/setgiftconfig.nd': setgiftconfig,
	'/getaccount.nd': getaccount,
	'/leaveddz.nd': leaveddz,
	'/setFreeze.nd': setFreeze,
	'/jcFreeze.nd': jcFreeze,
	'/sendGift.nd': sendGift
};

