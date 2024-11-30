"use strict";

import { parseMTL, parseMapArgs, parseOBJ } from "/js/parse.js";
import { vs, fs } from "/js/shaders.js";
import { getExtents, getGeometriesExtents, degToRad } from "/js/utils.js";

async function main() {
  /** @type {HTMLCanvasElement} */
  const canvas = document.querySelector("canvas");
  const gl = canvas.getContext("webgl");
  if (!gl) {
    return;
  }

  const meshProgramInfo = webglUtils.createProgramInfo(gl, [vs, fs]);

  const objHref = "/resources/donut tutorial.obj";
  const response = await fetch(objHref);
  const text = await response.text();
  const obj = parseOBJ(text);
  const baseHref = new URL(objHref, window.location.href);
  const matTexts = await Promise.all(
    obj.materialLibs.map(async (filename) => {
      const matHref = new URL(filename, baseHref).href;
      const response = await fetch(matHref);
      return await response.text();
    })
  );
  const materials = parseMTL(matTexts.join("\n"));

  const defaultMaterial = {
    diffuse: [1, 1, 1],
    ambient: [0, 0, 0],
    specular: [1, 1, 1],
    shininess: 400,
    opacity: 1,
  };

  const parts = obj.geometries.map(({ material, data }) => {

    if (data.color) {
      if (data.position.length === data.color.length) {
        data.color = { numComponents: 3, data: data.color };
      }
    } else {
      data.color = { value: [1, 1, 1, 1] };
    }

    const bufferInfo = webglUtils.createBufferInfoFromArrays(gl, data);
    return {
      material: materials[material],
      bufferInfo,
    };
  });

  const extents = getGeometriesExtents(obj.geometries);
  const range = m4.subtractVectors(extents.max, extents.min);
  const objOffset = m4.scaleVector(
    m4.addVectors(extents.min, m4.scaleVector(range, 0.5)),
    -1
  );
  const cameraTarget = [0, 0, 0];

  const radius = m4.length(range) * 1.2;
  const cameraPosition = m4.addVectors(cameraTarget, [0, 0, radius]);

  const zNear = radius / 100;
  const zFar = radius * 3;

  function degToRad(deg) {
    return (deg * Math.PI) / 180;
  }

  function render(time) {
    time *= 0.001; 

    webglUtils.resizeCanvasToDisplaySize(gl.canvas);
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    gl.enable(gl.DEPTH_TEST);

    const fieldOfViewRadians = degToRad(60);
    const aspect = gl.canvas.clientWidth / gl.canvas.clientHeight;
    const projection = m4.perspective(fieldOfViewRadians, aspect, zNear, zFar);

    const up = [0, 1, 0];
    const camera = m4.lookAt(cameraPosition, cameraTarget, up);

    const view = m4.inverse(camera);

    const sharedUniforms = {
      u_lightDirection: m4.normalize([-1, 3, 5]),
      u_view: view,
      u_projection: projection,
      u_viewWorldPosition: cameraPosition,
    };

    gl.useProgram(meshProgramInfo.program);

    webglUtils.setUniforms(meshProgramInfo, sharedUniforms);

    let u_world = m4.yRotation(time);
    u_world = m4.translate(u_world, ...objOffset);

    for (const { bufferInfo, material } of parts) {
      webglUtils.setBuffersAndAttributes(gl, meshProgramInfo, bufferInfo);
      webglUtils.setUniforms(
        meshProgramInfo,
        {
          u_world,
        },
        material
      );
      webglUtils.drawBufferInfo(gl, bufferInfo);
    }

    requestAnimationFrame(render);
  }
  requestAnimationFrame(render);
}

main();
