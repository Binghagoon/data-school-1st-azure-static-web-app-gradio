/**
 * [1단계] 전역 변수 및 지도 초기 설정
 */
var container = document.getElementById("map");
var options = { center: new kakao.maps.LatLng(37.5665, 126.978), level: 4 };
var map = new kakao.maps.Map(container, options);

var myMarker = null;
var polyline = null;
var routeSteps = [];
var lastSpokenStep = -1;
var watchId = null;

var fontSize = 20;
var MIN_FONT_SIZE = 16;
var MAX_FONT_SIZE = 36;

/**
 * [2단계] 음성 출력 및 다시듣기 함수 (목소리 고정 버전)
 */
var selectedVoice = null;

// 브라우저에서 목소리 목록이 로드되면 미리 한국어 목소리를 찜해둡니다.
function loadVoices() {
  var voices = window.speechSynthesis.getVoices();
  // 한국어 목소리 중 구글 엔진 -> 유나 -> 첫 번째 한국어 순으로 고정
  selectedVoice = voices.find((v) => v.name.includes("Google") && v.lang === "ko-KR") ||
                  voices.find((v) => v.name.includes("Yuna") && v.lang === "ko-KR") ||
                  voices.find((v) => v.lang === "ko-KR" || v.lang.includes("ko"));
}

// 크롬 및 모바일 브라우저 대응을 위해 이벤트 리스너 등록
if (window.speechSynthesis.onvoiceschanged !== undefined) {
  window.speechSynthesis.onvoiceschanged = loadVoices;
}
loadVoices(); // 초기 로드 시도

function speak(text) {
  var subtitleBox = document.getElementById("subtitle-box");
  if (subtitleBox) {
    subtitleBox.innerHTML = "🔊 " + text.replace(/\. /g, ".<br>");
  }

  if (typeof SpeechSynthesisUtterance === "undefined") return;

  // 이전 음성이 겹치지 않게 취소
  window.speechSynthesis.cancel();

  var smoothText = text
    .replace(/미터/g, " 미터, ")
    .replace(/후/g, "후,   ")
    .replace(/요/g, "요.    ")
    .replace(/다/g, "다.    ");

  var msg = new SpeechSynthesisUtterance(smoothText);
  
  // 미리 로드된 selectedVoice가 있으면 적용, 없으면 다시 한번 찾기
  if (!selectedVoice) loadVoices();
  if (selectedVoice) msg.voice = selectedVoice;

  msg.lang = "ko-KR";
  msg.rate = 0.85; // 어르신을 위한 느긋한 속도
  msg.pitch = 1.0;
  msg.volume = 1.0;

  window.speechSynthesis.speak(msg);
}

function replayGuidance() {
  var subtitleBox = document.getElementById("subtitle-box");
  if (!subtitleBox) return;
  var currentHTML = subtitleBox.innerHTML.replace("🔊", "").trim();
  var textToSpeak = currentHTML.replace(/<br>/g, " ");

  if (!textToSpeak || textToSpeak.includes("찾는 중") || textToSpeak.includes("확인했습니다")) {
    speak("현재 안내 중인 경로가 없습니다. 가고 싶은 쉼터를 먼저 선택해 주세요.");
    return;
  }
  speak(textToSpeak);
}

/**
 * [3단계] UI 레이어 생성
 */
function createUI() {
  var welcome = document.createElement("div");
  welcome.id = "welcome-layer";
  welcome.style.cssText = "position:fixed; top:0; left:0; width:100%; height:100%; background:white; z-index:10000; display:flex; flex-direction:column; align-items:center; justify-content:center; padding:20px; text-align:center;";
  welcome.innerHTML = `<div style="font-size: 80px; margin-bottom: 20px;">🔊</div><h1 style="font-size: 30px;">반갑습니다!</h1><p style="font-size: 22px;">안내를 위해 <b>소리를 크게</b> 키워주세요.</p><button onclick="startApp()" style="margin-top: 30px; padding: 20px 50px; font-size: 24px; background: #4CAF50; color: white; border: none; border-radius: 15px; font-weight: bold;">확인했습니다</button>`;
  document.body.appendChild(welcome);

  var ui = document.createElement("div");
  ui.style.cssText = "position:fixed; bottom:20px; left:50%; transform:translateX(-50%); width:90%; z-index:9999; display:flex; flex-direction:column; gap:12px;";
  ui.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center;">
        <button id="btn-replay" onclick="replayGuidance()" style="padding:12px 18px; background:#FF9800; color:white; border:none; border-radius:10px; font-weight:bold; font-size:16px; box-shadow: 0 4px 8px rgba(0,0,0,0.3); cursor:pointer;">🔄 다시듣기</button>
        <div style="display:flex; gap:8px;">
            <button id="btn-font-plus" onclick="changeFontSize(4)" style="padding:12px 18px; background:white; border:1px solid #ccc; border-radius:10px; font-weight:bold; font-size:16px; cursor:pointer;">글자 +</button>
            <button id="btn-font-minus" onclick="changeFontSize(-4)" style="padding:12px 18px; background:white; border:1px solid #ccc; border-radius:10px; font-weight:bold; font-size:16px; cursor:pointer;">글자 -</button>
        </div>
    </div>
    <div id="subtitle-box" style="background:rgba(0,0,0,0.85); color:white; padding:20px; border-radius:15px; font-size:20px; font-weight:bold; text-align:center; min-height:80px; line-height:1.5; box-shadow: 0 4px 15px rgba(0,0,0,0.5);">주변 쉼터를 찾는 중...</div>
  `;
  document.body.appendChild(ui);
  updateFontSizeButtons();
}

function changeFontSize(delta) {
  fontSize = Math.min(MAX_FONT_SIZE, Math.max(MIN_FONT_SIZE, fontSize + delta));
  var subtitleBox = document.getElementById("subtitle-box");
  if (subtitleBox) subtitleBox.style.fontSize = fontSize + "px";
  updateFontSizeButtons();
}

function updateFontSizeButtons() {
  var btnPlus = document.getElementById("btn-font-plus");
  var btnMinus = document.getElementById("btn-font-minus");
  if (!btnPlus || !btnMinus) return;
  btnPlus.disabled = fontSize >= MAX_FONT_SIZE;
  btnMinus.disabled = fontSize <= MIN_FONT_SIZE;
  btnPlus.style.backgroundColor = btnPlus.disabled ? "#e0e0e0" : "white";
  btnMinus.style.backgroundColor = btnMinus.disabled ? "#e0e0e0" : "white";
}

function initLocation() {
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(function (pos) {
      var locPos = new kakao.maps.LatLng(pos.coords.latitude, pos.coords.longitude);
      if (!myMarker) {
        myMarker = new kakao.maps.Marker({
          position: locPos, map: map,
          image: new kakao.maps.MarkerImage("https://t1.daumcdn.net/localimg/localimages/07/mapapidoc/marker_red.png", new kakao.maps.Size(35, 35))
        });
      } else { myMarker.setPosition(locPos); }
      map.setCenter(locPos);
      speak("내 위치를 확인했습니다. 가고 싶은 쉼터를 눌러보세요.");
    }, (err) => speak("위치 정보를 가져올 수 없습니다."));
  }
}

function startApp() {
  document.getElementById("welcome-layer").remove();
  initLocation();
}

/**
 * [5단계] 경로 검색 (목적지 변경 최적화)
 */
function findRoute(endLat, endLng, shelterName) {
  // [추가] 길안내가 시작되면 열려 있는 모든 팝업을 닫습니다.
  openedInfowindows.forEach(iw => iw.close());
  openedInfowindows = [];

  // [강력 초기화 1] 실시간 추적 즉시 중단
  if (watchId !== null) {
    navigator.geolocation.clearWatch(watchId);
    watchId = null;
  }

  // [강력 초기화 2] 기존 지도 위의 파란색 선(경로) 완전히 삭제
  if (polyline) {
    polyline.setMap(null);
    polyline = null; // 메모리에서도 비워줍니다.
  }

  // [강력 초기화 3] 데이터 리셋
  lastSpokenStep = -1;
  routeSteps = [];

  // 자막 박스도 초기화해서 사용자에게 알림
  var subtitleBox = document.getElementById("subtitle-box");
  if (subtitleBox) subtitleBox.innerHTML = "새로운 경로를 계산 중입니다...";

  navigator.geolocation.getCurrentPosition(function (pos) {
    var startLat = pos.coords.latitude;
    var startLng = pos.coords.longitude;
    
    // 유턴 방지 옵션이 포함된 URL
    var url = "https://router.project-osrm.org/route/v1/foot/" + 
              startLng + "," + startLat + ";" + 
              endLng + "," + endLat + 
              "?overview=full&geometries=geojson&steps=true&continue_straight=true";

    fetch(url)
      .then((res) => res.json())
      .then((data) => {
        if (data.code === "Ok") {
          var route = data.routes[0];
          
          // 경로 데이터 생성 및 유턴 필터링
          routeSteps = [];
          route.legs[0].steps.forEach(function (step) {
            var m = step.maneuver;
            // 유턴이나 급회전 단계는 음성 안내에서 제외
            if (m.modifier && (m.modifier.includes("u-turn") || m.modifier.includes("sharp"))) return;

            var dist = Math.round(step.distance);
            var stepText = "";
            if (m.type === "depart") stepText = "안내를 시작합니다. ";
            else if (m.type === "arrive") stepText = "목적지 근처에 도착했습니다. ";
            else {
              if (dist > 10) stepText = dist + "미터 직진 후 ";
              if (m.modifier === "left") stepText += "왼쪽으로 꺾으세요. ";
              else if (m.modifier === "right") stepText += "오른쪽으로 꺾으세요. ";
              else stepText += "앞으로 이동하세요. ";
            }
            routeSteps.push({ lat: m.location[1], lng: m.location[0], instruction: stepText });
          });

          // 새 경로 선 그리기
          var linePath = route.geometry.coordinates.map(c => new kakao.maps.LatLng(c[1], c[0]));
          polyline = new kakao.maps.Polyline({
            path: linePath,
            strokeWeight: 8,
            strokeColor: "#3301fc",
            strokeOpacity: 0.8
          });
          polyline.setMap(map);

          // 지도 화면 범위를 새 경로에 맞게 조정
          var bounds = new kakao.maps.LatLngBounds();
          linePath.forEach(p => bounds.extend(p));
          map.setBounds(bounds);

          // 안내 시작 멘트
          var durationMin = Math.ceil(route.distance / 50);
          speak(shelterName + "까지 안내를 시작할게요. 약 " + durationMin + "분 정도 걸립니다.");

          lastSpokenStep = 0;
          startTracking();
        }
      });
  });
}

function startTracking() {
  watchId = navigator.geolocation.watchPosition(function (pos) {
    var curLat = pos.coords.latitude;
    var curLng = pos.coords.longitude;
    if (myMarker) myMarker.setPosition(new kakao.maps.LatLng(curLat, curLng));

    for (var i = 0; i < routeSteps.length; i++) {
      if (i <= lastSpokenStep) continue;
      var dist = getDistance(curLat, curLng, routeSteps[i].lat, routeSteps[i].lng);
      if (dist < 40) {
        lastSpokenStep = i;
        var curText = "이제 " + routeSteps[i].instruction;
        var nextText = routeSteps[i + 1] ? "그 다음은 " + routeSteps[i + 1].instruction : "";
        speak(curText + nextText);
        break;
      }
    }
  }, null, { enableHighAccuracy: true });
}

function getDistance(lat1, lng1, lat2, lng2) {
  var R = 6371;
  var dLat = (lat2 - lat1) * Math.PI / 180;
  var dLon = (lng2 - lng1) * Math.PI / 180;
  var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))) * 1000;
}

/**
 * [추가] 열려 있는 인포윈도우들을 관리하는 배열 (최대 3개 유지용)
 */
var openedInfowindows = [];

window.initMarkers = function (shelterData) {
  shelterData.forEach(function (s) {
    var marker = new kakao.maps.Marker({
      position: new kakao.maps.LatLng(s.lat, s.lng),
      map: map,
    });

    var content = `
      <div style="padding:10px; font-size:14px; color:black; min-width:150px;">
        <strong>${s.name}</strong><br>
        <button onclick="findRoute(${s.lat}, ${s.lng}, '${s.name}')" 
                style="margin-top:10px; cursor:pointer; width:100%; height:30px; background:#4CAF50; color:white; border:none; border-radius:5px;">
          🚶 길안내 시작
        </button>
      </div>`;

    var infowindow = new kakao.maps.InfoWindow({
      content: content,
      removable: true,
    });

    // 마커 클릭 이벤트
    kakao.maps.event.addListener(marker, "click", function () {
      // [핵심] 1. 이 팝업이 이미 열려 있는지 확인합니다.
      var isAlreadyOpen = openedInfowindows.includes(infowindow);

      if (!isAlreadyOpen) {
        // 2. 새로운 팝업을 열 때만 개수를 체크합니다.
        if (openedInfowindows.length >= 3) {
          var oldest = openedInfowindows.shift(); // 가장 오래된 팝업 꺼내기
          oldest.close(); // 지도에서 닫기
        }

        // 3. 새 팝업을 열고 배열에 추가
        infowindow.open(map, marker);
        openedInfowindows.push(infowindow);
      } else {
        // [선택] 이미 열려 있는 경우, 사용자 피드백을 위해 살짝 닫았다가 다시 열어줄 수도 있고
        // 그냥 아무것도 안 해도 됩니다. 지금은 그대로 두는 방식을 택할게요!
      }
    });

    // 팝업의 [X] 버튼이나 리무버블 기능을 통해 닫혔을 때 배열에서 제거
    kakao.maps.event.addListener(infowindow, 'close', function() {
      openedInfowindows = openedInfowindows.filter(iw => iw !== infowindow);
    });
  });
};

createUI();