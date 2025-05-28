
let reclamos = [];

function agregarReclamo(usuario, descripcion) {
    const nuevoReclamo = {
        id: reclamos.length + 1,
        usuario: usuario,
        descripcion: descripcion,
        fecha: new Date(),
        estado: 'Pendiente'
    };
    reclamos.push(nuevoReclamo);
    return nuevoReclamo;
}

function listarReclamos() {
    return reclamos;
}

module.exports = { agregarReclamo, listarReclamos, actualizarEstado };