'use strict';

var sign = require('./sign');
var fs = require('fs');
var path = require('path');
var https = require('https');
var xmlreader = require('xmlreader');

var dirname = path.dirname(module.filename);

// 开发配置
const CONFIG = {
	mch_appid: 'wxdf264faf1b28ceea',
	mchid: '1393084802',
	sign_key: 'qwertyuiopasdfghjklzxcvbnm123456',
	ca: fs.readFileSync(dirname + '/rootca.pem'),
	key: fs.readFileSync(dirname + '/appkey.pem'),
	cert: fs.readFileSync(dirname + '/appcert.pem')
};

// 签名方法
exports.sign = function (params, key) {
	var res = sign.make_sign(params, key);
	for (let i in params) {
		if (!res[i]) res[i] = params[i];
	}
	return res;
};

// 生成XML
exports.xml = function (params) {
	var xml = '<xml>';
	for (let i in params) {
		xml += `<${i}>${params[i]}</${i}>`;
	}
	return (xml += '</xml>');
};

// 企业支付
exports.pay = function (orderid, openid, money, desc, callback) {
	var options = {
		hostname: 'api.mch.weixin.qq.com',
		port: 443,
		method: 'post',
		ca: CONFIG.ca,
		key: CONFIG.key,
		cert: CONFIG.cert,
		path: '/mmpaymkttransfers/promotion/transfers'
	};
	var req = https.request(options, (res) => {
		var xml = '';
		res.on('data', (data) => {
			xml += data;
		});
		res.on('end', () => {
			xmlreader.read(xml, (err, res) => callback(err, res));
		});
	});
	req.on('error', (err) => callback(err));
	var params = {
		mch_appid: CONFIG.mch_appid,
		mchid: CONFIG.mchid,
		partner_trade_no: orderid,
		openid: openid,
		check_name: 'NO_CHECK',
		amount: money,
		desc: desc,
		spbill_create_ip: '127.0.0.1'
	};
	params = this.sign(params, CONFIG.sign_key);
	req.write(this.xml(params));
	req.end();
};

// 错误描述
exports.errString = function (code) {
	const DESC = {
		NOAUTH: '没有权限',
		AMOUNT_LIMIT: '付款金额不能小于最低限额',
		PARAM_ERROR: '参数错误',
		OPENID_ERROR: 'Openid错误',
		NOTENOUGH: '余额不足',
		SYSTEMERROR: '系统繁忙，请稍后再试。',
		NAME_MISMATCH: '姓名校验出错',
		SIGN_ERROR: '签名错误',
		XML_ERROR: 'Post内容出错',
		FATAL_ERROR: '两次请求参数不一致',
		CA_ERROR: '证书出错'
	};
	return DESC[code] || DESC.SYSTEMERROR;
};

