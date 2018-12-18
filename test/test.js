/*
TODO needs refactoring and cleanup
 */
var assert = require('assert'); //replace with shouldjs
var should = require('should');
var fs = require('fs');

let client, log, gray,emailRenderer;
const { Variables } = require('camunda-external-task-client-js');
const nodemailer = require('nodemailer'),
    emailTemplates = require('email-templates');
const SMTPServer = require('smtp-server').SMTPServer;
const request = require('request');

let Client, serverOptions, voidFn = function () {};
describe('Array', function() {
    before(function(){
        process.env.NODE_ENV    = 'development';
        process.env.TOPIC       = 'test.external.mail.sender';
        process.env.BASE_URL    = "http://localhost:8080/engine-rest";
        process.env.MAX_TASK    = 1;
        process.env.MAX_TASK    = 1000;
        process.env.ASYNC_RESPONSE_TIMEOUT    = 10000;
        process.env.LOG_FILE = 'false';

        let deps = require('@kai-raschke/prodig-external-deps')();
        client = deps.client;
        log = deps.log;
        gray = deps.gray;
        emailRenderer = require('./../email-renderer');

        Client = client.init();

        serverOptions = {
            name: 'localhost',
            port: 2525,
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

        Client.subscribe(process.env.TOPIC, async function(){
            let transporter = nodemailer.createTransport({
                host: serverOptions.name,
                port: serverOptions.port,
                secure: serverOptions.secure,
                authMethod: serverOptions.authMethods[0], //'LOGIN'
                auth: { user: 'username', pass: 'pass' }, //not relevant, every auth is valid
                tls: { rejectUnauthorized: false } //self signed cert for localhost
            });

            let mail = await transporter.sendMail({
                from:   'from@example.com',
                to:     'to@example.com',
                text:   'My mail'
            });

            /* console.log(mail);
            { accepted: [ 'to@example.com' ],
              rejected: [],
              envelopeTime: 3,
              messageTime: 3,
              messageSize: 239,
              response: '250 Content-Type: text/plain',
              envelope: { from: 'from@example.com', to: [ 'to@example.com' ] },
              messageId: '<a3e70458-8e1e-af54-9253-3ae88251a19b@example.com>' }
             */
            //assert.strictEqual(err, null);
            //assert.notStrictEqual(info, null);
        })
    });

    describe('Test transport', function(){
        it('Should send 1 message', function(done){
            let transporter = nodemailer.createTransport({
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
        });
    });

    describe('Test templates', function(){
        it('Should render test template', async function(){
            let emailRender = new emailTemplates({
                render: emailRenderer.render
            });

            let template = await emailRender.renderAll('prodig.test', { to: 'test@example.com' });

            should.equal(template.subject, 'Test Mail');
            should.equal(template.text, 'Test text to test@example.com');
            //should equal html version
        });
    });

    describe('Test Camunda', function(){
        it('Should deploy and send', function(done){
            Client.start();

            serverOptions.onData = (stream, session, callback) => {
                const chunks = [];
                stream.on("data", function (chunk) {
                    chunks.push(chunk);
                });
                stream.on('end', function () {
                    let s = Buffer.concat(chunks).toString();
                    Client.stop();
                    //server.close();
                    done();
                    callback(null, s);
                });
            };
            const server = new SMTPServer(serverOptions);
            server.listen(serverOptions.port);

            request.post({
                    url:'http://localhost:8080/engine-rest/deployment/create',
                    formData: {
                        'deployment-name': 'Send single mail',
                        'file': fs.createReadStream(__dirname + '/../bpmn/send-single-test-mail.bpmn')
                    }
                },
                function optionalCallback(err, httpResponse, body) {
                    if (err)
                        return console.error('upload failed:', err);

                    try {
                        request.post({
                                url: `http://localhost:8080/engine-rest/process-definition/key/send-single-test-mail/start`,
                                body: {},
                                json: true,
                            });
                        //done() is called in smtp server response
                    } catch (e) { throw e.response ? e.response.body : e; }
            });
        });
    });
});