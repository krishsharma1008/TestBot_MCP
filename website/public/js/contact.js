$(function () {
    'use strict'

    // Form

    var contactForm = function () {
        var $form = $('#contactForm')
        if (!$form.length) {
            return
        }

        var endpoint =
            $form.data('endpoint') ||
            (window.contactConfig && window.contactConfig.endpoint) ||
            'php/send-email.php'

        $form.validate({
            rules: {
                name: 'required',
                email: {
                    required: true,
                    email: true,
                },
                message: {
                    required: true,
                    minlength: 5,
                },
            },
            messages: {
                name: 'Please enter your name',
                email: 'Please enter a valid email address',
                message: 'Please enter a message',
            },
            submitHandler: function (form) {
                var $submit = $('.submitting'),
                    waitText = 'Submitting...'

                $.ajax({
                    type: 'POST',
                    url: endpoint,
                    data: $(form).serialize(),
                    beforeSend: function () {
                        $('#form-message-warning').hide()
                        $('#form-message-success').hide()
                        $submit.css('display', 'block').text(waitText)
                    },
                    success: function (msg) {
                        if (msg === 'OK' || (msg && msg.ok)) {
                            setTimeout(function () {
                                $('#contactForm').fadeOut()
                            }, 800)
                            setTimeout(function () {
                                $('#form-message-success').fadeIn()
                            }, 1100)
                        } else {
                            $('#form-message-warning')
                                .html(typeof msg === 'string' ? msg : 'Unexpected response')
                                .fadeIn()
                            $submit.css('display', 'none')
                        }
                    },
                    error: function (xhr) {
                        var message =
                            xhr.responseText ||
                            'Something went wrong. Please try again.'
                        $('#form-message-warning').html(message).fadeIn()
                        $submit.css('display', 'none')
                    },
                })
            },
        })
    }
    contactForm()
})
