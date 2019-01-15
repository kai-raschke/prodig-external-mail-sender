'use strict';

const { Variables } = require('camunda-external-task-client-js');
const nodemailer = require('nodemailer'),
    emailTemplates = require('email-templates'),
    emailRenderer = require('./email-renderer');
const { client, log, gray } = require('@kai-raschke/prodig-external-deps')(
    /* Optional config object */
);

let transporter, transportForce;

/***
 * Main task for subscription
 * @param task
 * @param taskService
 * @returns {Promise<void>}
 */
let main = async function({ task, taskService }){
    try{
        const processVariables  = new Variables();

        //process.env variables are prioritized over JSON mail variables
        //JSON mail variables are prioritized over mail-connector variables

        //Variables like original camunda-mail connector https://github.com/camunda/camunda-bpm-mail#send-mails
        //including new replyTo
        let to                  = task.variables.get("to")              || undefined;
        let cc                  = task.variables.get("cc")              || undefined;
        let bcc                 = task.variables.get("bcc")             || undefined;
        let replyTo             = task.variables.get("replyTo")         || undefined;
        let fromAlias           = task.variables.get("fromAlias")       || undefined;
        let subject             = task.variables.get("subject")         || undefined;
        let text                = task.variables.get("text")            || undefined;
        let html                = task.variables.get("html")            || undefined;

        let attachments          = task.variables.get('attachments')      || "[]"; //Nodemailer attachments format https://nodemailer.com/message/attachments/

        let mailTemplate        = task.variables.get("mailTemplate")    || undefined;
        let mailVariables       = task.variables.get("mailVariables")   || "{}";
        let mailOptions         = task.variables.get("mailOptions")     || "{}";

        mailVariables   = JSON.parse(mailVariables);
        mailOptions     = JSON.parse(mailOptions);
        attachments      = JSON.parse(attachments);

        //Extra option for attachment in addition to nodemailers options
        //If a variable is given, try to find it and get the buffer from
        for(let i = -1; ++i < attachments.length;){
            let attachment = attachments[i];
            if(attachment.variable){
                let fileVar = task.variables.get(attachment.variable);
                if(fileVar)
                    attachment.content = fileVar.content; //attach Buffer from Camunda file variable
            }
        }

        mailOptions.forceRealSend   = (process.env.FORCE_REAL_SEND === 'true' ? true : mailOptions.forceRealSend || false); //Force smtp transporter in dev mode
        mailOptions.returnMessageId = mailOptions.returnMessageId || false; //return the Message ID of sent mail

        //Forces real smtp transporter when in dev mode
        if(mailOptions.forceRealSend){
            transporter = transportForce;
        }

        const MAIL_FROM_ALIAS = process.env.MAIL_FROM_ALIAS || mailVariables.alias || fromAlias; //by priorities
        const from = (MAIL_FROM_ALIAS ? { //Use Alias if there was one delivered
            name: MAIL_FROM_ALIAS,
            address: process.env.MAIL_FROM
        } : process.env.MAIL_FROM);
        //If staging mode, overwrite receiver with static testing address, if not set, send to yourself
        const MAIL_STAGING = (process.env.MAIL_STAGING ? process.env.MAIL_STAGING : from); //In staging no real mail shall be sent

        let envelope = {
            to: (process.env.NODE_ENV === 'staging' ? MAIL_STAGING : mailVariables.to || to),
            from: (MAIL_FROM_ALIAS ? { //Use Alias if there was one delivered
                name: MAIL_FROM_ALIAS,
                address: process.env.MAIL_FROM
            } : process.env.MAIL_FROM), //Otherwise use just from address
            cc:     mailVariables.cc        || cc,
            bcc:    mailVariables.bcc       || bcc,
            replyTo:mailVariables.replyTo   || replyTo,
        };

        let template = {
            subject, text, html
        };

        //If email template is defined render with engine otherwise use camunda-mail connector settings
        if(mailTemplate){
            try{
                let emailRender = new emailTemplates({
                    render: emailRenderer.render
                });

                template = await emailRender.renderAll(mailTemplate, mailVariables);
                log.debug(`Render templates done`);
            } catch(ex){
                await taskService.handleFailure(task, "An error occured while rendering the templates");
            }
        }
        else{
            template.subject = subject;
            template.text = text;
            template.html = html;
        }

        try{
            let mail = await transporter.sendMail({
                from:   envelope.from,
                to:     envelope.to,
                cc:     envelope.cc,
                bcc:    envelope.bcc,
                replyTo:envelope.replyTo,
                subject:template.subject,
                text:   template.text,
                html:   template.html,
                attachments
            });

            if(mail.accepted){
                if(mail.accepted.length > 0){
                    gray.warning('Email-sent', {type: 'metric', value: 1}); //graylog metrics
                }
                else{
                    log.warn('No mail was sent');
                }
            }

            if(mailOptions.returnMessageId === true){
                processVariables.set("messageId", mail.messageId);
            }

            //TODO check response for '250 ok' and/or 'accepted' matches the input addresses
            //TODO Throw BPMN errors on specific failure

            await taskService.complete(task, processVariables);
        } catch(ex){
            await taskService.handleFailure(task, "An error occured while sending the mail");
        }
    }
    catch(ex){
        log.error(ex);
        await taskService.handleFailure(task, "An error occured - strange ...");
    }
};

/***
 * Anonymous start function, subscribes to topic by given NODE_ENV
 */
(function start(){
    try {
        //nodemail smtp settings
        let smtpWorkflowConfig = {
            host: process.env.SMTP_SERVER, //defaults to localhost
            port: (isNaN(parseInt(process.env.SMTP_PORT)) ? undefined : parseInt(process.env.SMTP_PORT)), //defaults by nodemailer to 587/465 if not set
            secure: (process.env.SMTP_SECURE === 'true'), // upgrade later with STARTTLS
            requireTLS: (process.env.SMTP_REQUIRE_TLS === 'true'),
            logger: log,
            auth: (process.env.SMTP_AUTH === "true" ?
                    {
                        user: process.env.SMTP_USER,
                        pass: process.env.SMTP_PASS
                    } :
                    undefined
            )
        };

        transportForce = transporter = nodemailer.createTransport(smtpWorkflowConfig);
        // verify connection configuration
        transporter.verify(function(error, success) {
            if (error) {
                log.error(error);
            } else {
                log.info('Server is ready to take our messages');
            }
        });

        if(process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test'){
            //Create JSON stream transporter when in dev mode
            transporter = nodemailer.createTransport({
                jsonTransport: true,
                logger: log
            });

            //allow testing Camunda external task through http interface if in dev mode
            require('./mock').start(main);
        }

        client.subscribe(process.env.TOPIC, main);
        client.start();
    } catch (e) {
        log.error(e);
    }
})();

