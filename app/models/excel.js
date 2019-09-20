'use strict';

var excel = require('../../share/XlsModule');

module.exports = function(app) {
	app.models['Excel'] = excel;
};

