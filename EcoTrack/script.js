function areAnagrams(str1, str2) {

    str1 = str1.toLowerCase();
    str2 = str2.toLowerCase();

    if (str1.length !== str2.length) {
        return false;
    }

    let sorted1 = str1.split("").sort().join("");
    let sorted2 = str2.split("").sort().join("");

    return sorted1 === sorted2;
}

function checkAnagram() {

    let str1 = document.getElementById("str1").value;
    let str2 = document.getElementById("str2").value;

    let result = document.getElementById("result");

    if (areAnagrams(str1, str2)) {
        result.innerHTML = "True — The strings are anagrams.";
    } else {
        result.innerHTML = "False — The strings are not anagrams.";
    }
}