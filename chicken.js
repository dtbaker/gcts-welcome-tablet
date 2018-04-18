
var touch_or_click = 'click';

var ChickenMQTT = (function(){

    var client;
    var reconnectTimeout = 3000;
    var callbacks=[];

    function connect() {

        $('#console').text('MQTT Reconnecting...');

        mqtt = new Paho.MQTT.Client(
            TechSpaceChicken.get_config('host'),
            TechSpaceChicken.get_config('port'),
            "/ws",
            "checkin-web"
        );
        var options = {
            timeout: 3,
            useSSL: false,
            cleanSession: true,
            onSuccess: function(){
                $('#console').text('');
                mqtt.subscribe('#', {qos: 0});
            },
            onFailure: function (message) {
                //alert('Failed to connect to MQTT');
                setTimeout(connect, reconnectTimeout);
            }
        };

        mqtt.onConnectionLost = function(response) {
            setTimeout(connect, reconnectTimeout);
            console.log("Connection lost...");
            $('#console').text('MQTT Connection Lost. Check WIFI is working and try the Reset button.');
            //alert('MQTT Connection Lost');
            //window.location.href='index.html';
        };

        mqtt.onMessageArrived = function (message) {
            var topic = message.destinationName;
            var payload = message.payloadString;
            console.log(topic + ' = ' + payload );
            //$('#console').text('Debug: MQTT Received: ' + topic + ' = ' + payload);
            for(var i in callbacks){
                if(callbacks.hasOwnProperty(i)){
                    callbacks[i](topic, payload);
                }
            }
        };

        mqtt.connect(options);
    }

    return {
        init: function(){
            connect();
        },
        callback: function(func){
            callbacks.push(func);
        }
    }

})();

var TechSpaceChicken = (function () {

    var $overlay = $('#overlay');
    var $form_sections = $('#form-sections');
    var opening = false;
    var currently_checking_in = false;
    var config = {
        host: '10.0.1.254',
        webport: 81,
        path: '/',
        port: 9001
    };
    var current_rfid = '';
    var printMessageTimeout = 500;
    var userCheckinTimeout = 30000;
    var userTimeoutTimer = null;

    function startUiTimeout(){

        if(userTimeoutTimer)clearTimeout( userTimeoutTimer );

        $('#timeout').addClass('loading');
        userTimeoutTimer = setTimeout( function(){
            //$('#timeout').removeClass('loading');
            $('#console').text('Interface timeout, resetting...');
            window.location.href = 'index.html';
        }, userCheckinTimeout );
    }

    function endUiTimeout(){

        if(userTimeoutTimer)clearTimeout( userTimeoutTimer );
        $('#timeout').removeClass('loading');
    }

    function wakeupUi(){
        // cancel the timeout
        if(userTimeoutTimer)clearTimeout( userTimeoutTimer );
        $('#timeout').removeClass('loading');
        userTimeoutTimer = setTimeout( function(){
            startUiTimeout();
        }, 5000 );
    }

    function template(template_id, contents){
        var html = $('#' + template_id).html();
        for(var i in contents){
            if(contents.hasOwnProperty(i)){
                var re = new RegExp("{" + i + "}","g");
                html = html.replace(re, contents[i]);
            }
        }
        return html;
    }
    function clearForms(){
        // adds bounce out css class.
        // removes elements.
        $form_sections.find('li.section').addClass('bounce-out');
        setTimeout(function(){
            $form_sections.find('li.section').remove();
        },390);
    }
    function addMessage(message, messageOptions){
        var $message = $(template('form-section-message', {
            'content': message
        }));
        if(messageOptions && typeof messageOptions['once'] != 'undefined'){
            setTimeout(function(){
                $message.addClass('bounce-out');
                setTimeout(function(){
                    $message.remove();
                },390);
            },printMessageTimeout);
        }
        $form_sections.append($message);
        setTimeout(function(){
            $message.addClass('added');
        },100);
        setTimeout(function(){
            $message.addClass('bounce-in');
        },500);

    }
    function addInput(data){
        if(typeof data['value'] == 'undefined'){
            data['value'] = '';
        }
        var $message = $(template('form-section-input', data));
        $form_sections.append($message);
        setTimeout(function(){
            $message.addClass('added');
        },300);
        setTimeout(function(){
            $message.addClass('bounce-in');
        },600);
    }

    function answerQuestion(){
        // post this to server.
        var callback = $(this).parent().data('callback');
        var answerIndex = $(this).data('index');

        clearForms();
        setTimeout(function(){
            addLoading();
            $.post( "http://" + config['host'] + ':' + config['webport'] + config['path'] + 'api.php',
                {
                    rfid: current_rfid,
                    callback: callback,
                    answer: answerIndex
                }).done(function (data) {
                clearForms();
                setTimeout(function(){
                    if(data.messages){
                        queueMessages(data.messages);
                    }

                },410);
            });

        },410);

    }

    function answerInput(){
        // post this to server.
        var callback = $(this).parent().data('callback');
        var answerValue = $(this).parent().find('input').val();

        clearForms();
        setTimeout(function(){
            addLoading();
            $.post( "http://" + config['host'] + ':' + config['webport'] + config['path'] + 'api.php',
                {
                    rfid: current_rfid,
                    callback: callback,
                    answer: answerValue
                }).done(function (data) {
                clearForms();
                setTimeout(function(){
                    if(data.messages){
                        queueMessages(data.messages);
                    }

                },410);
            });

        },410);

    }

    function addQuestion(data){
        var $answers = $('<div class="answers"></div>');
        $answers.attr('data-callback', data.callback);
        for(var i in data.answers){
            $answers.append('<button data-index="' + i + '">' + data.answers[i] + '</button>');
        }
        data.answers = $answers[0].outerHTML;
        var $message = $(template('form-section-question', data));
        $form_sections.append($message);
        setTimeout(function(){
            $message.addClass('added');
        },300);
        setTimeout(function(){
            $message.addClass('bounce-in');
        },600);
    }

    function addLoading(){
        var $message = $(template('form-section-loading', {}));
        $form_sections.append($message);
        $message.addClass('added');
        $message.addClass('bounce-in');
    }

    function closeOverlay(){
        opening = false;
        endUiTimeout();
        currently_checking_in = false;
        $overlay.removeClass('open').addClass('close');
        setTimeout(function(){
            $overlay.removeClass('close').addClass('spin-end');
            clearForms();
        },1000);
    }
    function loading(){
        $overlay.removeClass('spin-end').addClass('spin');
    }
    function openGuestMode(){

        if(currently_checking_in)return;
        loading();


        currently_checking_in = true;
        current_rfid = 'guest';

        $.post( "http://" + config['host'] + ':' + config['webport'] + config['path'] + 'api.php',
            {
                checkpoint: 'ci',
                rfid: current_rfid
            }).done(function (data) {
            // once details arive open the overlay.
            openOverlay();
            if(data.messages){
                queueMessages(data.messages);
            }else{
                addMessage('Error');
            }
        });
    }
    function openOverlay(){
        if(opening)return;
        opening = true;
        startUiTimeout();
        $overlay.removeClass('spin').addClass('open');

    }
    var queued_messages = [];
    function queueMessages(m){
        queued_messages = m;
        printMessages();
    }
    function printMessages(){
        var currentMessage = queued_messages.shift();
        if(currentMessage){
            switch(currentMessage.type){
                case 'message':
                    addMessage(currentMessage.text, currentMessage);
                    break;
                case 'input':
                    addInput(currentMessage);
                    break;
                case 'question':
                    addQuestion(currentMessage);
                    break;
                case 'function':
                    switch(currentMessage.function){
                        case 'setManualRFID':
                            current_rfid = currentMessage.value;
                            break;
                        case "closeOverlay":
                            setTimeout(closeOverlay, parseInt(currentMessage.delay));
                            break;
                    }
                    break;
            }
        }
        setTimeout(printMessages, currentMessage && typeof currentMessage.delay != 'undefined' ? currentMessage.delay : printMessageTimeout);
    }
    var t = this;
    function registerClickEvents() {
        $('#logo > div').on( touch_or_click, openGuestMode );
        $('body').on( touch_or_click, wakeupUi );
        $(document).keydown(function(e) {
            wakeupUi();
        });
        $('#forms').on( touch_or_click, '.answers button', answerQuestion ).on( touch_or_click, '.input button', answerInput );
    }
    function connectMQTT(){
        ChickenMQTT.init();
        ChickenMQTT.callback(function(topic, message){
            switch(topic){
                case 'techspace/devices':
                    var bits = message.split(';');
                    if(bits.length == 2){
                        switch(bits[0]){
                            case 'ci':
                            case 'room-3':
                            case 'door':
                            case 'checkin':
                                // set loading animation.
                                if(currently_checking_in){
                                    // someone is already checking in. wait for this to finish.
                                    return;
                                }
                                currently_checking_in = true;
                                loading();
                                // pull details from ajax.
                                current_rfid = bits[1];

                                $.post( "http://" + config['host'] + ':' + config['webport'] + config['path'] + 'api.php',
                                {
                                    checkpoint: bits[0],
                                    rfid: current_rfid
                                }).done(function (data) {
                                    // once details arive open the overlay.
                                    openOverlay();
                                    if(data.messages){
                                        queueMessages(data.messages);
                                    }else{
                                        addMessage('Error');
                                    }
                                });
                                break;
                        }
                    }
                    break;
            }
        });

    }

    return {
        get_config: function(key){ return config[key]; },
        closeOverlay: closeOverlay,
        init: function () {
            registerClickEvents();
            connectMQTT();
            //
            return true;
        }
    };

})();
