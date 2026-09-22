/* Rangeland guide - behaviour only.
   Two jobs: the Highlights/Full detail toggle, and flipping the meeting
   box to the comment deadline once the workshop is over.
   No wording lives here except the two mode descriptions below. */

(function(){
  var KEY = "rangeland-reading-mode", root = document.documentElement, saved = null;
  try { saved = localStorage.getItem(KEY); } catch (e) {}
  var mode = (saved === "full") ? "full" : "brief";
  if (mode === "brief") root.classList.add("brief");

  function apply(m){
    root.classList.toggle("brief", m === "brief");
    var b = document.querySelectorAll(".seg button"), i;
    for (i = 0; i < b.length; i++){
      b[i].setAttribute("aria-pressed", b[i].getAttribute("data-mode") === m ? "true" : "false");
    }
    var n = document.getElementById("modenote");
    if (n) n.textContent = (m === "brief")
      ? "The corridor, the numbers, and the questions to ask."
      : "The whole guide \u2014 workings, definitions, caveats and sources.";
    try { localStorage.setItem(KEY, m); } catch (e) {}
    if (m === "brief" && window.scrollY > 400) window.scrollTo(0, 0);
  }

  document.addEventListener("DOMContentLoaded", function(){
    apply(mode);
    // Workshop #3 ended 24 Sep 2026, 7pm Eastern (23:00 UTC). After that the
    // meeting box switches to the comment deadline. Without JS it stays on the
    // workshop, which is the state that matters most before the night.
    try {
      var box = document.getElementById("meetingbox");
      if (box && Date.now() > Date.UTC(2026, 8, 24, 23, 0)) box.setAttribute("data-phase", "post");
    } catch (e) {}
    var seg = document.querySelector(".seg");
    if (!seg) return;
    seg.addEventListener("click", function(e){
      var t = e.target;
      while (t && t !== seg && t.tagName !== "BUTTON") t = t.parentNode;
      if (t && t.tagName === "BUTTON") apply(t.getAttribute("data-mode"));
    });
  });
})();