var assert = require('assert'); //replace with shouldjs
var should = require('should');

const { client, log, gray } = require('@kai-raschke/prodig-external-deps');
const { Variables } = require('camunda-external-task-client-js');
const nodemailer = require('nodemailer'),
    emailTemplates = require('email-templates'),
    emailRenderer = require('./../email-renderer');
const SMTPServer = require('smtp-server').SMTPServer;

let Client, serverOptions, voidFn = function () {};
describe('Array', function() {
    before(function(){
        Client = client.init();
        serverOptions = {
            name: 'localhost',
            port: 465,
            secure: true,
            authMethods: ['LOGIN'],
            onData: (stream, session, callback) => {
                const chunks = [];
                stream.on("data", function (chunk) {
                    chunks.push(chunk);
                });
                stream.on('end', function () {
                    let s = Buffer.concat(chunks).toString();
                    callback(null, s);
                });
            },
            onAuth: (auth, session, callback) => {
                //Allow all logins
                callback(null, {user: true});
            }
        };
    });

    describe('Test transport', function(){
        it('Should send 1 message', function(done){
            transporter = nodemailer.createTransport({
                host: serverOptions.name,
                port: serverOptions.port,
                secure: serverOptions.secure,
                authMethod: serverOptions.authMethods[0], //'LOGIN'
                auth: { user: 'username', pass: 'pass' }, //not relevant, every auth is valid
                tls: { rejectUnauthorized: false } //self signed cert for localhost
            });

            const server = new SMTPServer(serverOptions);
            server.listen(serverOptions.port);

            transporter.sendMail({
                from:   'from@example.com',
                to:     'to@example.com',
                text:   'My mail'
            }, function(err, info) {
                //console.log(err, info);
                assert.strictEqual(err, null);
                assert.notStrictEqual(info, null);
                server.close();
                done();
            });
        })
    })
});