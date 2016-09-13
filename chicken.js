
var touch_or_click = 'click';

var TechSpaceChicken = (function () {

    var $overlay = $('#overlay');
    var $form_sections = $('#form-sections');
    var opening = false;

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
        },400);
    }
    function timerClick(){
        // user chose a time they're going to be here for.

        // post this to server.

        clearForms();
        setTimeout(function(){
            addMessage('Thanks David!');
            setTimeout(function(){
                closeOverlay();
            },2000);
        },400);
    }
    function addMessage(message){
        var $message = $(template('form-section-template', {
            'content': message
        }));
        $form_sections.append($message);
        setTimeout(function(){
            $message.addClass('added');
        },100);
        setTimeout(function(){
            $message.addClass('bounce-in');
        },500);

    }
    function addTimer(){
        var $message = $(template('form-section-question', {
        }));
        $form_sections.append($message);
        setTimeout(function(){
            $message.addClass('added');
        },300);
        setTimeout(function(){
            $message.addClass('bounce-in');
        },600);

    }

    function closeOverlay(){
        opening = false;
        $overlay.removeClass('open').addClass('close');
        setTimeout(function(){
            $overlay.removeClass('close');
            clearForms();
        },400);
    }
    function openOverlay(){
        if(opening)return;
        opening = true;
        $overlay.addClass('spin');
        setTimeout(function(){
            $overlay.removeClass('spin').addClass('open');
            addMessage('Welcome David!');
            setTimeout(function(){
                addMessage('Your membership expires in <strong>124</strong> days.');
            },2000);
            setTimeout(function(){
                addTimer();
            },4000);
        },3000);

    }
    function registerClickEvents() {
        $('#logo > div').on( touch_or_click, openOverlay );
        $('#forms').on( touch_or_click, '.timer-buttons button', timerClick );
    }
    var config = {
        stuff: ''
    };

    return {
        init: function () {
            registerClickEvents();
            return true;
        }
    };

})();
