const _pIpc = require('../index.js');

describe('new pIpc()', function () {
    it('should not throw', function () {
        let pIpc = new _pIpc('test',{
            appid: 'com.example.app',
        });
    });
});
