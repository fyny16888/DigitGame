'use strict';

var quick = require('quick-pomelo');
var P = quick.Promise;
var _ = require('lodash');
var http = require('http');
var url = require('url');
var md5 = require('md5');
var qs = require('querystring');
var uuid = require('node-uuid');
var wxpay = require('./weixin/wxpay');

var channelPaySign = require('./index.js');
var httpRequest = require('./baidu/httpRequest.js');
var logger = quick.logger.getLogger('payServer', __filename);

// 处理器
var handler = {};

// 60game order 自增数
var sixtyGameCount = 0;

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
		//新加支付完成通知接口，限制ip
		if (pathname == '/payNotify.nd') {
			var getIP = req.headers['x-forwarded-for'] ||
				req.connection.remoteAddress ||
				req.socket.remoteAddress ||
				req.connection.socket.remoteAddress;
			var ip = getIP.match(/:(\d+?\.\d+?\.\d+?\.\d+)$/)[1];
			console.warn(getIP, ip);
			var whiteList = ['127.0.0.1', '58.211.137.154','139.198.189.93'];
			if (_.findIndex(whiteList, function (n) { return n == ip }) == -1) {
				res.write('WARNING: Not Auth!');
				return res.end();
			}
		}
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
	if (typeof query === 'object') {
		res.write(JSON.stringify(query));
	}
	else {
		res.write(String(query));
	}
	res.end();
};

// 签名验证
function checkMd5(query) {
	var signKey = 'defe6d21422c8b770767f74fcea84714';

	var sign = query['sign'];
	if (!sign) return false;

	var userId = query['userid'];
	var out_trade_no = query['out_trade_no'];
	var shopId = query['shopid'];
	var total_fee = query['total_fee'];

	var _sign = md5(`out_trade_no=${out_trade_no}&shopid=${shopId}&total_fee=${total_fee}&userid=${userId}&key=${signKey}`);
	if (_sign.toLowerCase() != sign.toLowerCase()) {
		return false;
	}
	return true;
};

// 充值处理
var pay = function (query, method, res) {
	if (!checkMd5(query)) {
		return writeOut('fail: sign error!', res);
	}
	var shopId = Number(query['shopid']);
	if (!shopId) {
		return writeOut('fail: shopid error!', res);
	}
	var playerId = query['userid'];
	if (!playerId) {
		return writeOut('fail: userid error!', res);
	}
	var out_trade_no = query['out_trade_no'];
	var total_fee = Number(query['total_fee']);
	return handler.addDiamondAsync(playerId, 'hz_' + out_trade_no, shopId, total_fee, res);
};


var getUserAndGoodInfo = P.coroutine(function* (query, method, res) {

});

/**
 * baidu支付订单生成
 */
var baiduCreateOrder = P.coroutine(function* (query, method, res) {
	var paytype = Number(query['paytype']) || 1;
	if (!query['playerId'] || !query['shopId']) {
		return writeOut('fail', res);
	}
	var playerId = query['playerId']
	// if (playerId.split('@')[1] != 'baidu') {
	// 	return writeOut('notreg', res);
	// }
	var sdcustomno = uuid.v1();
	var a = new Date();
	const customerid = 155141;
	const noticeurl = 'http://139.198.3.29:82/baiduPayNotify.nd';
	const backurl = 'http://bd.17letui.com/dwc/index.php?fwid=fixed';
	var onum = a.getYear() + String(a.getTime()).substr(-8) + a.getMonth() + _.random(1, 100000) + a.getDate() + sixtyGameCount;
	var app = handler.app;
	return app.memdb.goose.transactionAsync(P.coroutine(function* () {
		var player = yield app.models.Player.findByIdReadOnlyAsync(playerId, 'account');
		if (!player) {
			return writeOut('notreg', res);
		}
		var shop_good = yield app.models.Shop.findByIdReadOnlyAsync(Number(query['shopId']));
		if (!shop_good) return writeOut('notshop', res);
		// var url = 'http://www.zhifuka.net/gateway/weixin/wap-weixinpay.asp?';
		var url = 'http://www.zhifuka.net/gateway/weixin/weixinpay.asp?';
		if (paytype == 2) {
			url = 'http://www.zhifuka.net/gateway/weixin/wap-weixinpay.asp?';
		}
		var sign = channelPaySign.sixtygame.md5Sign(['customerid=' + customerid, 'sdcustomno=' + sdcustomno, 'orderAmount=' + shop_good.rmb,
			'cardno=32', 'noticeurl=' + noticeurl, 'backurl=' + backurl].join('&'), 'e689b932b6d71d067d03f2c6a96ff09c');
		var ext = onum + '|' + query['playerId'] + '|' + query['shopId'];
		var urlData = {
			customerid: customerid, sdcustomno: sdcustomno, orderAmount: shop_good.rmb, cardno: 32, noticeurl: noticeurl, backurl: backurl
			, sign: sign.toUpperCase(), mark: ext
		};
		return writeOut(url + qs.stringify(urlData), res);
	}), app.getServerId())
		.then(() => app.event.emit('transactionSuccess'), () => app.event.emit('transactionFail'));
});

/**
 * baidu支付回调
 */
var baiduPayNotify = function (query, method, res) {
	console.warn('baiduPayNotify', query);
	var md5SF = channelPaySign.sixtygame.md5Sign(['customerid=' + query['customerid'], 'sd51no=' + query['sd51no'], 'sdcustomno=' + query['sdcustomno'],
	'mark=' + query['mark'], 'key=e689b932b6d71d067d03f2c6a96ff09c'].join('&'), '');
	if (md5SF.toUpperCase() != query['sign']) {
		return writeOut({ status: 'fail sign auth' }, res);
	}
	var md5SS = channelPaySign.sixtygame.md5Sign(['sign=' + md5SF.toUpperCase(), 'customerid=' + query['customerid'], 'ordermoney=' + query['ordermoney'],
	'sd51no=' + query['sd51no'], 'state=' + query['state'], 'key=e689b932b6d71d067d03f2c6a96ff09c'].join('&'), '');
	if (md5SS.toUpperCase() != query['resign']) {
		return writeOut({ status: 'fail resign auth' }, res);
	}
	var ext = query['mark'].split('|');
	if (query['ordermoney'].match(/^\./)) {
		query['ordermoney'] = Number(0 + query['ordermoney']);
	}
	return handler.addDiamondAsync(ext[1], 'bd_' + query['sd51no'], ext[2], Number(query['ordermoney']) * 100, res, '<result>1</result>');
};

/**
 * 60game 组装提交支付用数据
 */
var createSixtyData = P.coroutine(function* (query, method, res) {
	if (!query['playerId'] || !query['shopId']) {
		return writeOut('not id', res);
	}
	var app = handler.app;
	var nowTime = Date.now(); var randomNumber = _.random(1, 1000);
	var a = new Date();
	var onum = a.getYear() + String(a.getTime()).substr(-8) + a.getMonth() + _.random(1, 100000) + a.getDate() + sixtyGameCount;
	sixtyGameCount += 1;
	return app.memdb.goose.transactionAsync(P.coroutine(function* () {
		var spid = '123';
		var player = yield app.models.Player.findByIdReadOnlyAsync(query['playerId'], 'name');
		if (!player) {
			return writeOut('player not found', res);
		}
		var shop_good = yield app.models.Shop.findByIdAsync(query['shopId']);
		if (!shop_good) return writeOut('good not found', res);
		var oi = spid + '_' + onum;
		var sign = channelPaySign.sixtygame.md5Sign(oi + shop_good.rmb + spid);
		return writeOut({ orderid: oi, money: shop_good.rmb, product: shop_good.name, sign: sign, attach: JSON.stringify({ userid: query['playerId'], shopid: query['shopId'] }) }, res);
	}), app.getServerId())
		.then(() => app.event.emit('transactionSuccess'), () => app.event.emit('transactionFail'));
});

/**
 * 60game  支付回调
 */
var sixtyPayNotify = function (query, method, res) {
	console.warn(query);
	if (query['status'] == 1) {
		var md5S = channelPaySign.sixtygame.md5Sign(query);
		if (md5S != query['sign']) {
			return writeOut('fail:sign is not very', res);
		}
		var attach = query['attach'];
		attach = JSON.parse(attach);
		return handler.addDiamondAsync(attach.userid, 'sg_' + query['orderid'], attach.shopid, Number(query['money']), res, 'OK');
	}
	else {
		return writeOut('OK', res);
	}
};

/**
 * 群黑 组装提交支付用数据
 * 群黑和60游戏共用一个加密方式
 */
var createQunheiData = P.coroutine(function* (query, method, res) {
	if (!query['playerId'] || !query['shopId'] || !query['username']) {
		return writeOut('fail', res);
	}
	var app = handler.app;
	var a = new Date();
	var onum = a.getYear() + String(a.getTime()).substr(-8) + a.getMonth() + _.random(1, 100000) + a.getDate() + sixtyGameCount;
	return app.memdb.goose.transactionAsync(P.coroutine(function* () {
		var gid = '3452';
		var player = yield app.models.Player.findByIdReadOnlyAsync(query['playerId'], 'name');
		if (!player) {
			return writeOut('fail', res);
		}
		var shop_good = yield app.models.Shop.findByIdAsync(Number(query['shopId']));
		if (!shop_good) return writeOut('fail', res);
		var ext = onum + '|' + query['playerId'] + '|' + query['shopId'];
		var sign = channelPaySign.sixtygame.md5Sign((shop_good.rmb / 100) + '' + query['username'] + ext, 'bf69337ee6a215c9abd1c153e75339c8');
		return writeOut({ ext: ext, userId: query['username'], goodsId: query['shopId'], gid: gid, money: shop_good.rmb / 100, roleName: player.name, goodsName: shop_good.name, sign: sign }, res);
	}), app.getServerId())
		.then(() => app.event.emit('transactionSuccess'), () => app.event.emit('transactionFail'));
});

/**
 * 群黑  支付回调
 */
var qunheiPayNotify = function (query, method, res) {
	console.warn(query);
	var md5S = channelPaySign.sixtygame.md5Sign(query['orderno'] + query['username'] + query['serverid']
		+ query['addgold'] + query['rmb'] + query['paytime'] + query['ext']
		, 'bf69337ee6a215c9abd1c153e75339c8');
	console.warn(md5S);
	if (md5S != query['sign']) {
		return writeOut(-4, res);
	}
	var ext = query['ext'].split('|');
	return handler.addDiamondAsync(ext[1], 'qh_' + query['orderno'], ext[2], Number(query['rmb']) * 100, res, 1);
};

/**
 * 就要玩支付数据组装
 * @return 要跳转的url
 */
var nopCreateData = P.coroutine(function* (query, method, res) {
	if (!query['playerId'] || !query['shopId'] || !query['user_id'] || !query['channelExt']) {
		return writeOut('fail', res);
	}
	var app = handler.app;
	var a = new Date();
	var onum = a.getYear() + String(a.getTime()).substr(-8) + a.getMonth() + _.random(1, 100000) + a.getDate() + sixtyGameCount;
	return app.memdb.goose.transactionAsync(P.coroutine(function* () {
		var game_appid = 'F2F574C4FD7B9759D', key = '201704131739';
		var player = yield app.models.Player.findByIdReadOnlyAsync(query['playerId'], 'name');
		if (!player) {
			return writeOut('fail', res);
		}
		var shop_good = yield app.models.Shop.findByIdAsync(Number(query['shopId']));
		if (!shop_good) return writeOut('fail', res);
		var ext = onum + '|' + query['playerId'] + '|' + query['shopId'];
		var sign = channelPaySign.sixtygame.md5Sign(['game_appid=' + game_appid, 'trade_no=' + ext, 'props_name=' + shop_good.name,
		'amount=' + shop_good.rmb, 'user_id=' + query['user_id'], 'channelExt=' + query['channelExt'], 'key=' + key].join('&'), '');
		let urlData = { channelExt: query['channelExt'], user_id: query['user_id'], trade_no: ext, game_appid: game_appid, amount: shop_good.rmb, props_name: shop_good.name, sign: sign };
		return writeOut('http://www.jywgame.com/media.php/Game/game_pay?' + qs.stringify(urlData), res);
	}), app.getServerId())
		.then(() => app.event.emit('transactionSuccess'), () => app.event.emit('transactionFail'));
});

/**
 * 就要玩 支付回调
 */
var nopPayNotify = function (query, method, res) {
	console.warn('nopPayNotify', query);
	var md5S = channelPaySign.sixtygame.md5Sign(['source=' + query['source'], 'trade_no=' + query['trade_no'], 'out_trade_no=' + query['out_trade_no'],
	'amount=' + query['amount'], 'game_appid=F2F574C4FD7B9759D', 'key=201704131739'].join('&'), '');
	if (md5S != query['sign']) {
		return writeOut({ status: 'fail sign auth' }, res);
	}
	var ext = query['trade_no'].split('|');
	return handler.addDiamondAsync(ext[1], 'nop_' + query['out_trade_no'], ext[2], Number(query['amount']), res, { status: 'success' });
};

/**
 * YXD支付创建
 */
var yxdCreatePay = P.coroutine(function* (query, method, res) {
	if (!query['playerId'] || !query['shopId']) {
		return writeOut('fail', res);
	}
	var app = handler.app;
	const yxdUri = 'game.yxd17.com';
	var a = new Date();
	var tmp = Date.parse(a).toString();
	tmp = tmp.substr(0, 10);
	var onum = a.getYear() + String(a.getTime()).substr(-8) + a.getMonth() + _.random(1, 100000) + a.getDate() + sixtyGameCount;
	return app.memdb.goose.transactionAsync(P.coroutine(function* () {
		var app_key = '50e74027c511842d', app_secret = '05dd640d0cc8b8d3ed9a53828e78ba70';
		var player = yield app.models.Player.findByIdReadOnlyAsync(query['playerId'], 'name');
		if (!player) {
			return writeOut('fail', res);
		}
		var shop_good = yield app.models.Shop.findByIdAsync(Number(query['shopId']));
		if (!shop_good) return writeOut('fail', res);
		var ext = onum + '|' + query['playerId'] + '|' + query['shopId'];
		var getRUO = {
			app_key: app_key,
			open_id: query['playerId'].split('@')[0],
			money: (shop_good.rmb / 100).toFixed(2),
			game_order_no: onum,
			title: shop_good.name,
			attach: ext,
			notify_url: 'http://139.198.3.29:82/yxdPayNotify.nd',//还未分配服务器
			timestamp: tmp,
			nonce: uuid.v1().split('-').join('')
		};
		var sign = channelPaySign.sixtygame.sha1Sign(getRUO, app_secret);
		getRUO.signature = sign;
		var dt = qs.stringify(getRUO);
		console.warn('getRUO', getRUO);
		var hr = yield httpRequest.requestAsync({
			method: "POST", headers: {
				"Content-Type": 'application/x-www-form-urlencoded',
				"Content-Length": dt.length
			}, hostname: yxdUri, path: '/api/pay/unified/order', data_obj: getRUO
		});
		if (hr.ret && hr.ret == 2) {
			console.warn('error', hr.msg);
			return writeOut('fail', res);
		}
		if (hr.result_code && hr.result_code == 'SUCCESS') {
			var returnData = {
				prepay_id: hr['prepay_id'],
				app_key: app_key,
				timestamp: tmp,
				nonce: uuid.v1().split('-').join('')
			};
			var rsign = channelPaySign.sixtygame.sha1Sign(returnData, app_secret);
			returnData.signature = rsign;
			return writeOut(returnData, res);
		}
		return writeOut('fail', res);
	}), app.getServerId())
		.then(() => app.event.emit('transactionSuccess'), () => app.event.emit('transactionFail'));
});

/**
 * yxd支付回调
 * @param {*} query 
 * @param {*} method 
 * @param {*} res 
 */
var yxdPayNotify = function (query, method, res) {
	console.warn('yxdPayNotify', query);
	var sign = query['signature'];
	if (sign) {
		var app_secret = '05dd640d0cc8b8d3ed9a53828e78ba70';
		delete query['signature'];
		var ss = channelPaySign.sixtygame.sha1Sign(query, app_secret);
		if (ss == sign && query['result_code'] == 'SUCCESS') {
			var ext = query['attach'].split('|');
			return handler.addDiamondAsync(ext[1], 'yxd_' + query['trade_no'], ext[2], Number(query['money']) * 100, res, 'SUCCESS');
		}
		return writeOut('FAIL', res);
	}
	return writeOut('FAIL', res);
}

/**
 * 初诺支付数据创建
 * @param {Object} query 
 * @param {String} method 
 * @param {Object} res 
 */
var cnCreatePay = function (query, method, res) {

}

/**
 * 初诺支付回调
 * @param {*} query 
 * @param {*} method 
 * @param {*} res 
 */
var cnPayNotify = function (query, method, res) {

}

var payNotify = function (query, method, res) {
	console.warn('payNotify', query);
	var pre_str = query['pre_str']; var order_no = query['order_no']; var shopId = query['shopId']; var money = query['money'];
	var successMsg = query['successMsg'] || 'success';
	//数据有效性验证
	return handler.addDiamondAsync(query['playerId'], order_no, shopId, money, res, successMsg);
}

// 增加钻石
handler.addDiamondAsync = P.coroutine(function* (playerId, out_trade_no, shopId, total_fee, res, successMsg) {
	var app = this.app;
	return app.memdb.goose.transactionAsync(P.coroutine(function* () {
		var payrecord = yield app.models.PayRecord.findByIdReadOnlyAsync(out_trade_no, 'account');
		if (payrecord) {
			return writeOut(successMsg || 'fail: out_trade_no has exists!', res);
		}
		var player = yield app.models.Player.findByIdReadOnlyAsync(playerId, 'account');
		var shop_good = yield app.models.Shop.findByIdReadOnlyAsync(shopId);
		if (!player || !shop_good || shop_good.rmb != total_fee) {
			return writeOut('fail: player or shop_good not found!', res);
		}
		var initData = yield app.controllers.hall.initRechargeAsync(playerId, shop_good);
		if (!initData) {
			return writeOut('fail: execute charge error!', res);
		}
		initData.data.id = shopId;
		yield app.controllers.player.pushAsync(playerId, 'dwc_pay', initData.data);
		payrecord = new app.models.PayRecord({ _id: out_trade_no, account: player.account, shopId: shopId, total_fee: total_fee });
		yield payrecord.saveAsync();
		return writeOut(successMsg || 'success', res);
	}), app.getServerId())
		.then(() => app.event.emit('transactionSuccess'), () => app.event.emit('transactionFail'));
});

// 提现处理
var money = function (query, method, res) {
	var playerId = query['userid'];
	if (!playerId) {
		return writeOut('fail: param error!', res);
	}
	var hour = (new Date()).getHours();
	if (hour != 10) {
		// return writeOut('fail: 201', res);
	}
	return handler.exchangeMoneyAsync(playerId, res);
};

// 发放现金
var sendMoneyAsync = P.promisify(function (openId, money, cb) {
	var orderId = uuid.v1().replace(/-/g, '');
	return wxpay.pay(orderId, openId, money, '提现', (err, res) => {
		if (err) return cb(null, { code: -1, msg: 'system error!' });
		var xml = res.xml;
		if (xml.return_code.text() != 'SUCCESS') {
			return cb(null, { code: -1, msg: xml.return_msg.text() });
		}
		if (xml.result_code.text() != 'SUCCESS') {
			return cb(null, { code: -1, msg: xml.err_code_des.text() });
		}
		return cb(null, { code: 0, orderId: xml.partner_trade_no.text() });
	});
});

// 兑换现金
handler.exchangeMoneyAsync = P.coroutine(function* (playerId, res) {
	var openId = playerId;
	var pos = playerId.lastIndexOf('@');
	if (pos != -1) {
		openId = playerId.substr(0, pos);
	}
	var app = this.app;
	return app.memdb.goose.transactionAsync(P.coroutine(function* () {
		var player = yield app.models.Player.findByIdAsync(playerId, 'account backRmb');
		if (!player || !(player.backRmb >= 100)) {
			return writeOut('fail: money not enough ￥1!', res);
		}
		var backRmb = player.backRmb;
		if (backRmb > 20000) backRmb = 20000;
		var resSend = yield sendMoneyAsync(openId, backRmb);
		if (resSend.code != 0) {
			logger.warn('sendMoneyAsync fail: [%s]', resSend.msg);
			return writeOut(`fail: ${resSend.msg}！`, res);
		}
		player.backRmb -= backRmb;
		yield player.saveAsync();
		yield app.controllers.player.pushAsync(playerId, 'dwc_money', { backRmb: String(backRmb) });
		var exchangeRecord = new app.models.ExchangeRecord({ _id: resSend.orderId, account: player.account, backRmb: backRmb });
		yield exchangeRecord.saveAsync();
		return writeOut('success', res);
	}), app.getServerId())
		.then(() => app.event.emit('transactionSuccess'), () => app.event.emit('transactionFail'));
});

// 充值测试
var paytest = function (query, method, res) {
	var shopId = Number(query.shopid);
	var userId = query.userid;
	var total_fee = Number(query.total_fee);
	if (!shopId || !userId || !total_fee) {
		return writeOut('fail: param error!', res);
	}
	return handler.addDiamondAsync(userId, uuid.v1(), shopId, total_fee, res);
};

// 消息路由
var route = {
	'/pay.nd': pay,
	// '/paytest.nd': paytest,
	'/baiduPayNotify.nd': baiduPayNotify,
	'/sixtyPayNotify.nd': sixtyPayNotify,
	'/baiduCreateOrder.nd': baiduCreateOrder,
	'/createSixtyData.nd': createSixtyData,
	'/createQunheiData.nd': createQunheiData,
	'/qunheiPayNotify.nd': qunheiPayNotify,
	'/nopCreateData.nd': nopCreateData,
	'/nopPayNotify.nd': nopPayNotify,
	'/yxdPayNotify.nd': yxdPayNotify,
	'/yxdCreatePay.nd': yxdCreatePay,
	'/payNotify.nd': payNotify,
	'/money.nd': money
};