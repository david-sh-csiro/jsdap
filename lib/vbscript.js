"use strict";

export default function(IE_HACK) {
    if (IE_HACK) {
        let elem = document.createElement("script");
        elem.setAttribute("type", "text/vbscript");

        elem.innerHTML =
            "\n\
            Function BinaryToArray(Binary)\n Dim i\n ReDim byteArray(LenB(Binary))\n\
            For i = 1 To LenB(Binary)\n byteArray(i-1) = AscB(MidB(Binary, i, 1))\n\
            Next\n BinaryToArray = byteArray\n End Function\n ";

        document.head.appendChild(elem);
    }
}
