<?php

// loads same local member cache as the RFID door access system:
// https://github.com/dtbaker/techspace-door-php
require_once '/opt/php-door/inc.php';

$result = array();
$result['messages'] = array();

sleep(1);

header('Content-type: text/json');

$rfid = $_REQUEST['rfid'];
$callback = isset($_REQUEST['callback']) ? $_REQUEST['callback'] : false;
$answer = isset($_REQUEST['answer']) ? $_REQUEST['answer'] : false;

// look up this member by rfid
$member = get_member_by_rfid($rfid);
if(!$member){
	// guest mode. send welcome back along with signup form fields.
	$result['messages'][] = array(
		'type' => 'message',
		'text' => 'Welcome!',
	);
	$result['messages'][] = array(
		'type' => 'input',
		'text' => 'What is your email address?',
		'pause' => true,
		'callback' => 'validate_email',
	);
	$result['messages'][] = array(
		'type' => 'input',
		'text' => 'What is your name?',
		'pause' => true,
		'callback' => 'validate_name',
	);
}else{
	// existing member.
	$name_bits = explode(' ',$member['member_name']);

	$visit_times = array(
		'Quick visit',
		'An hour',
		'A few hours',
		'Not sure',
	);

	switch($callback){
		case 'validate_time':
			// user selected $answer index in $visit_times
			// post this to slack? post this to wordpress as well for logging.

			wordpress_api('checkin', array(
				'access' => 'do_checkin',
				'rfid' => $rfid,
				'time' => $visit_times[$answer],
			));


			$result['messages'][] = array(
				'type' => 'message',
				'text' => 'Thanks '.htmlspecialchars($name_bits[0]) .'!',
			);
			$result['messages'][] = array(
				'type' => 'function',
				'function' => 'closeOverlay',
				'delay' => 2000
			);


			break;
		default:
			$result['messages'][] = array(
				'type' => 'message',
				'text' => 'Welcome '.htmlspecialchars($name_bits[0]) .'!',
			);

			if($member['membership_expiry_days'] > 0) {
				$result['messages'][] = array(
					'type' => 'message',
					'text' => 'Your membership expires in <strong>' . (int)$member['membership_expiry_days'].'</strong> days.',
				);
			}else{
				$result['messages'][] = array(
					'type' => 'message',
					'warning' => true,
					'text' => 'Your membership has expired! Please renew :) ',
				);
			}

			$result['messages'][] = array(
				'type' => 'question',
				'text' => 'How long are you going to be here today?',
				'answers' => $visit_times,
				'pause' => true,
				'callback' => 'validate_time',
			);

	}



}


echo json_encode($result);