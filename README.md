# prodig-external-mail-sender [ALPHA]

A Node.js microservice for sending emails as an external task handed over by 
Camunda WFMS.

It is intended to be more flexible than the integrated mail-connector and
fits better into the microservice architecture we want to set up (less code in 
BPMN and Camunda). It still supports variables of the legacy connector.

The project is based on nodemailer, handlebars, mjml, camunda sdk and 
a support package ([prodig-external-deps](https://www.npmjs.com/package/@kai-raschke/prodig-external-deps)) - 
almost not micro any more :)

Email templates can be changed just-in-time without deploying a new process version
which we prefer in our use case.

It was built with PM2 as process manager in mind so all settings are set in the
app.json file in a [PM2 process file](http://pm2.keymetrics.io/docs/usage/application-declaration/) 
format.

For more information about our project, in which we use this service, you can visit our
webpage [Prodig@Students](https://prodig.uni-halle.de).

## Content

[Features](#features) \
[Setup](#setup) \
[Usage](#how-to-use) \
[How it works](#how-it-works) \
[BPMN examples](#bpmn-examples) \
[Email templates](#email-templates) \
[mailVariables object](#mailvariables-object) \
[Options](#options) \
[TODO](#todo) \
[License](#license)

## Features

- Connecting to Camunda External Task queue to process service tasks
- Sending emails with nodemailer
- Uses handlebars template engine to render Camunda task variables in emails
- Uses MJML templates (optional) to create newsletter like email templates
- Logging with bunyan (file-rotation) and optional Graylog backend

## Setup

1. Clone the repository 

    `git clone`

2. Install npm dependencies
    `npm install`

3. Rename `app.json.example` to `app.json`

4. Configure options in `app.json`

5. Run
    1. With nodejs `npm start`
    2. With PM2 `pm2 start app.json`


**Requirements:**
- No JAVA
- NodeJS >= 8.12.0 `tested and developed with, newer should work`
- Camunda >= 8.9 `prior 8.9 will not support async response`

## Usage

### Mock server

To send your first mail through the service you can use the mock server 
functionality to test your templates without Camunda running.

1. Set up the project and set the environment variable NODE_ENV to 
"development"
2. Start the app - `npm start`
3. Use Postman or curl to send a POST request to the mock server. Process
variables are submitted in POST body as JSON.

Example mock request:
```
curl -X POST http://localhost:45321 \
    -H 'Content-Type: application/json' \
    -d '{
  	"mailTemplate": "prodig.test",
  	"mailVariables": {
  		"to": "your.mail@example.net",
  	},
  	"mailOptions": {
  		"forceRealSend": "true"
  	}
  }'
```

### BPMN

1. Set up the project and configure a Camunda instance (BASE_URL)
2. Set the environment variable for topic subscription (TOPIC)
3. Set the external task topic in your BPMN 
4. Deploy your BPMN (... try one of the examples)
5. Start the app - `npm start`
6. Start the process through tasklist

You can use one of the examples to get started - [BPMN examples](#bpmn-examples)

## Environments

### Development

`NODE_ENV = "development"`
- Mock server is activated and can be used by a HTTP POST to localhost:45321
- Nodemailer streamed JSON transport is used as primary SMTP service
- SMTP settings are respected but not used (until forceRealSend is used as option)
- Full debugging

### Staging

`NODE_ENV = "staging"`
- Mock server will not be activated
- SMTP settings are respected but mail "to" is replaced with the email set in 
  env variable (MAIL_STAGING) or your "from" address (to prevent sending real mails within the staging environment)
- Less debugging (>= info)

### Production

`NODE_ENV = "production"`
- Mock server will not be activated
- SMTP settings are respected
- Less debugging (>= warning)

## How it works

The service uses the JS version of Camunda External Task Client. The library is 
acquired through the support package "prodig-external-deps" which is a base package
to all my microservices I use in our project.

The External Task Client uses Camundas task queue to process external tasks and 
responds to them. For more information see Camunda docs at [GitHub Project](https://github.com/camunda/camunda-external-task-client-js)

This service is intended to be run by PM2 Node.js process manager. The app.json 
is prepared to be used for starting the service. For more information 
about PM2 see [PM2 Homepage](http://pm2.keymetrics.io/).

Email templating can be done with MJML ([Homepage](https://mjml.io/)) which is an easy way to get well 
styled emails with less code.

All templates are rendered with handlebars to fill in Camunda process variables 
you hand over with your task.

Sending mails is done by nodemailer ([Homepage](https://nodemailer.com)) which uses basic SMTP settings.

Logging is done with bunyan.

## BPMN examples

The project includes BPMN examples to use with the service.

You can refer to the BPMN and example config in the project which uses 
'test.external.mail.sender' as topic subscription by default.

**Send single mail legacy**

File: send-single-mail-legacy.bpmn

Service task is used with Camunda mail-connector variables as input parameters.
You can use the parameters as described in the connector docs, including FreeMaker templates.

**Send single mail JSON**

File: send-single-mail.bpmn

Mail settings are saved in a process Variable (mailVariables) as stringified JSON.
Template is saved in mailTemplate.

**Send multiple mails**

File: send-multiple-mail.bpmn

Service task is used as sequential multiple instance task which sends all emails 
of a list one after another to the external task queue.

To generate a collection element a script task is utilized beforehand.
The list of emails could also be a process variable (e. g. set by an user task).

```
var ArrayList = Java.type("java.util.ArrayList")
var addressArrayList = new ArrayList()

//Semicolon separated list of emails
var list = "your.mail@example.net;your.mail.2@example.net"

var emails = list.split(';')

for (i in emails) {
    var email = emails[i]

    try {
        var addressObject = {
            to: email
        }

        var addressObjectStringified = JSON.stringify(addressObject)
        addressArrayList.add(addressObjectStringified)
    } catch (ex) {
        print(ex)
    }
}

execution.setVariable('emailList', addressArrayList)
```

## Email templates

Templating uses handlebars or handlebars/mjml to render emails.

All templates are organized in a special folder structure in `emails` and separated
by purpose (subject, text, html).

An existing mjml template file is prioritized over the handlebars file.

**Structure**

To create a new template you need to create a new subfolder under `emails`.
Name of the folder is later used as template name.

Rendering is done by `email-templates` which uses 3 files:

- subject - Email subject
- text - Email in text only format
- html - Email in html format

To be recognized by the handlebars rendering engine, the files extension is
.handlebars.

The folder structure looks like this:

```
emails -\
        \- templateName -\
                         |- subject.handlebars
                         |- text.handlebars
                         \- html.handlebars
```

**Handlebars** is always used to render process variables contained in the 
mailVariables object.

A handlebars expression is composed as `{{` variable `}}`, for example:
```
Hello {{fullname}},

you won the second price of our big holiday lottery.

Regards, Sp4mking2000
```

For all features of handlebars see their own docs at [https://handlebarsjs.com](https://handlebarsjs.com/).

**MJML** can be used to style templates. It is a responsive email framework
making it easy to create well styled emails.

To see all features see their own docs at [https://mjml.io](https://mjml.io/).

## mailVariables object

The mail variables object is used to send a stringified JSON object as process
variable to the service.

It was introduced to make the sequential multiple instance task working for
multiple receivers and is inspired by the original variable of mail-connector.

- **to**: Address of receiver
- **cc**: Carbon copy receiver
- **bcc**: Blind carbon copy receiver
- **alias**: Send-as alias
- **replyTo**: Reply to address if receiver wants to answer your mail
- **anyRandomKey**: Process variable to render in templates

Example:

```
{
    to:     "receiver@example.net",
    cc:     "cc@example.net",
    bcc:    "bcc@example.net",
    alias:  "My name is",
    replyTo:"inbox@example.net",
    name:   "John Jackson"
}
```

## Options

All application settings are set through [PM2 process file](http://pm2.keymetrics.io/docs/usage/application-declaration/) 
format. You can find an example in app.json.example.

Settings are read from app.json.

Settings are string values (e. g. "true" for bool) and will be parsed if necessary.

| ENV | Type | Default | Required | Description |
| --- | ---- | --- | --- | --- |
| NODE_ENV | development / staging / production | - | X | NodeJS execution environment |
| MAX_TASK | {Number} | 10 | | See [Camunda docs](https://github.com/camunda/camunda-external-task-client-js/blob/master/docs/Client.md#new-clientoptions) |
| INTERVAL | {Number} | 300 | | See [Camunda docs](https://github.com/camunda/camunda-external-task-client-js/blob/master/docs/Client.md#new-clientoptions) |
| ASYNC_RESPONSE_TIMEOUT | {Number} | - | | See [Camunda docs](https://github.com/camunda/camunda-external-task-client-js/blob/master/docs/Client.md#new-clientoptions) |
| LOCK_DURATION | {Number} | 50000 | | See [Camunda docs](https://github.com/camunda/camunda-external-task-client-js/blob/master/docs/Client.md#new-clientoptions) |
| BASE_URL | {String} | - | | See [Camunda docs](https://github.com/camunda/camunda-external-task-client-js/blob/master/docs/Client.md#new-clientoptions) |
| AUTH | {Boolean} | false | | Activate basic auth for Camunda Rest API |
| USER | {String} | - | If AUTH == true | Basic auth user |
| PASS | {String} | - | If AUTH == true | Basic auth password |
| SMTP_SERVER | {String} | localhost | | See "host" in [Nodemailer docs](https://nodemailer.com/smtp/) |
| SMTP_PORT | {Number} | 587 / 465 | | See "port" in [Nodemailer docs](https://nodemailer.com/smtp/) |
| SMTP_SECURE | {Boolean} | false | | See "secure" in [Nodemailer docs](https://nodemailer.com/smtp/) |
| SMTP_REQUIRE_TLS | {Boolean} | false | | See "requireTLS" in [Nodemailer docs](https://nodemailer.com/smtp/) |
| SMTP_AUTH | {Boolean} | - | | Activates SMTP auth for nodemailer |
| SMTP_USER | {String} | - | If SMTP_AUTH == true | See "user" in [Nodemailer docs](https://nodemailer.com/smtp/#authentication) |
| SMTP_PASS | {String} | - | If SMTP_AUTH == true | See "pass" in [Nodemailer docs](https://nodemailer.com/smtp/#authentication) |
| MAIL_FROM | {String} | - | X | Mail address to send from |
| MAIL_STAGING | {String} | MAIL_FROM | | Overwrites 'to' address in staging mode |
| TOPIC | {String} | - | | Camunda External Task topic |

## TODO

- Send mails with attachment
- Use .env file if no app.json is available
- Validate nodemailer response
- Enable more customized logging
- Consider unit tests
- Production testing

## License

MIT

## Credits

Kai Raschke, Johannes Damarovsky