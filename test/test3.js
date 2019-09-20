var Promise = require('quick-pomelo').Promise;
var fs = require("fs");

//方法Promise化
var readFileAsync = Promise.promisify(fs.readFile);

//链式调用断开
/*
var pp = Promise.resolve()
.then(function(){
	console.log(1);
})
.then(function(){
	console.log(2);
	return 555;
});

pp.then(function(x){
	console.log(x);
	return 666;
})
.delay(1000)
.then(function(x){
	console.log(x);
	return x;
}).
nodeify(test)
.then(function(){
	console.log('********************');
});
*/

var o =  {};
o.hhh = function(sss, cb) { // cb ====> function (err, result) { }
	cb(null, sss, 5);
}

Promise.resolve()
.then(function() {
	return Promise.promisify(o.hhh, o)(555);
})
.then(function(aaa) {
	console.log(aaa);
});

function test(excption, result){
	console.log(excption + '=========' + result);
}

// 调用then函数中调用Promise方法,返回单个Promise对象，会等待调用完成
/*
Promise.resolve()
.then(function () {
return readFileAsync('1.txt', 'utf-8');// , readFileAsync('2.txt', 'utf-8'),readFileAsync('3.txt', 'utf-8')];
 })
.then(function (s) {
 console.log("all:" + s) 
 });
-*/

// 调用then函数中调用Promise方法,返回多个Promise对象，不会等待调用完成
/*
Promise.resolve()
.then(function () {
return [readFileAsync('1.txt', 'utf-8') , readFileAsync('2.txt', 'utf-8'),readFileAsync('3.txt', 'utf-8')];
})
.all()
.then(function (array) {
 console.log("all:" + array);
 });
 */
 
