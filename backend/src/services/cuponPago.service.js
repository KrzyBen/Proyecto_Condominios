// services/cupon.service.js
import CuponPagoSchema from "../entity/cuponPago.entity.js";
import { AppDataSource } from "../config/configDb.js";
import UserSchema from "../entity/user.entity.js";

// Crear cupón mensual individual con verificación de duplicado
export async function crearCuponService(data) {
  try {
    const { vecinoId, mes, año, tipo = "mensual", ...cuponData } = data;

    const cuponRepository = AppDataSource.getRepository(CuponPagoSchema);
    const userRepository = AppDataSource.getRepository(UserSchema);

    const user = await userRepository.findOneBy({ id: vecinoId });
    if (!user || user.rol !== "vecino") {
      return [null, "El usuario no existe o no tiene rol de vecino"];
    }

    if (tipo === "mensual") {
      const existente = await cuponRepository.findOne({
        where: {
          mes,
          año,
          tipo: "mensual",
          vecino: { id: user.id },
        },
        relations: ["vecino"],
      });

      if (existente) {
        return [null, `Ya existe un cupón mensual para el mes ${mes}/${año} para este vecino`];
      }
    }

    const nuevoCupon = cuponRepository.create({
      mes,
      año,
      tipo,
      vecino: user,
      estado: "pendiente",
      ...cuponData,
    });

    const guardado = await cuponRepository.save(nuevoCupon);
    return [guardado, null];
  } catch (error) {
    return [null, `Error en crearCuponService: ${error.message}`];
  }
}

export async function generarCuponesMensualesParaVecinos(opciones = {}) {
  try {
    const {
      monto = 1000,
      descripcion = "",
      año = new Date().getFullYear(),
      descuentosPorcentaje = { 3: 20, 12: 30 } // porcentaje de descuento para marzo y diciembre
    } = opciones;

    const cuponRepository = AppDataSource.getRepository(CuponPagoSchema);
    const userRepository = AppDataSource.getRepository(UserSchema);

    const vecinos = await userRepository.findBy({ rol: 'vecino' });
    const cuponesNuevos = [];

    for (const vecino of vecinos) {
      for (let mes = 1; mes <= 12; mes++) {
        const existente = await cuponRepository.findOne({
          where: {
            mes,
            año,
            tipo: "mensual",
            vecino: { id: vecino.id }
          },
          relations: ["vecino"]
        });

        if (!existente) {
          const fechaPago = new Date(año, mes - 1, mes === 12 ? 20 : 25);
          fechaPago.setHours(0, 0, 0, 0);

          // Calcular descuento en base al porcentaje o cero si no aplica
          const porcentaje = descuentosPorcentaje[mes] || 0;
          const montoDescuento = Math.round((monto * porcentaje) / 100);

          const nuevo = cuponRepository.create({
            mes,
            año,
            monto,
            montoDescuento,
            descripcionPago: descripcion || `Pago cuota mensual ${mes}/${año}`,
            estado: "pendiente",
            tipo: "mensual",
            fechaPago,
            vecino
          });

          cuponesNuevos.push(nuevo);
        }
      }
    }

    const guardados = await cuponRepository.save(cuponesNuevos);
    return [guardados, null];
  } catch (error) {
    return [null, `Error al generar cupones mensuales: ${error.message}`];
  }
}

// Listar cupones por estado
export async function listarCuponesService(estado = null) {
  try {
    const cuponRepository = AppDataSource.getRepository(CuponPagoSchema);
    const estadosValidos = ["pendiente", "pagado", "comprometido","oculto"];

    const where = estado && estadosValidos.includes(estado) ? { estado } : {};
    const cupones = await cuponRepository.find({
      where,
      relations: ["vecino"],
      order: { año: "DESC", mes: "DESC" },
    });

    return [cupones, null];
  } catch (error) {
    return [null, `Error en listarCuponesService: ${error.message}`];
  }
}

// Actualizar cupón
export async function actualizarCuponService(id, nuevosDatos) {
  try {
    const cuponRepository = AppDataSource.getRepository(CuponPagoSchema);
    const userRepository = AppDataSource.getRepository(UserSchema);

    const cupon = await cuponRepository.findOne({
      where: { id },
      relations: ["vecino"],
    });

    if (!cupon) return [null, "Cupón no encontrado"];

    if (nuevosDatos.vecinoId) {
      const user = await userRepository.findOneBy({ id: nuevosDatos.vecinoId });
      if (!user || user.rol !== "vecino") {
        return [null, "El nuevo usuario no existe o no tiene rol de vecino"];
      }
      cupon.vecino = user;
    }

    delete nuevosDatos.vecinoId;
    Object.assign(cupon, nuevosDatos);

    const cuponActualizado = await cuponRepository.save(cupon);
    return [cuponActualizado, null];
  } catch (error) {
    return [null, `Error en actualizarCuponService: ${error.message}`];
  }
}

// Eliminar cupón
export async function eliminarCuponService(id) {
  try {
    const cuponRepository = AppDataSource.getRepository(CuponPagoSchema);
    const cupon = await cuponRepository.findOneBy({ id });

    if (!cupon) return [null, "Cupón no encontrado"];

    const estadosPermitidos = ["pagado", "oculto"];
    const hoy = new Date();
    const fechaLimite = new Date(hoy.getFullYear() - 2, hoy.getMonth(), hoy.getDate());

    // Comprobamos que el estado sea permitido
    if (!estadosPermitidos.includes(cupon.estado)) {
      return [null, "Solo se pueden eliminar cupones pagados u ocultos."];
    }

    // Comprobamos la antigüedad (usando fechaPago si existe, o una fecha aproximada)
    const fechaPago = cupon.fechaPago || new Date(cupon.año, cupon.mes - 1, 1);

    if (fechaPago > fechaLimite) {
      return [null, "Solo se pueden eliminar cupones de al menos 2 años de antigüedad."];
    }

    await cuponRepository.remove(cupon);
    return [cupon, null];

  } catch (error) {
    return [null, `Error en eliminarCuponService: ${error.message}`];
  }
}

// Listar todos los usuarios con rol 'vecino'
export async function listarVecinosService() {
  try {
    const userRepository = AppDataSource.getRepository(UserSchema);
    const vecinos = await userRepository.find({
      where: { rol: 'vecino' },
    });

    // Opcional: filtrar datos sensibles si es necesario
    const datosVecinos = vecinos.map(v => ({
      id: v.id,
      nombre: v.nombreCompleto,
      email: v.email,
      rut: v.rut
    }));

    return [datosVecinos, null];
  } catch (error) {
    return [null, `Error al listar vecinos: ${error.message}`];
  }
}

// Listar los cupones de un vecino específico
export async function listarCuponesVecinoService(idVecino) {
  try {
    const userRepository = AppDataSource.getRepository(UserSchema);
    const cuponRepository = AppDataSource.getRepository(CuponPagoSchema);

    const vecino = await userRepository.findOneBy({ id: idVecino });

    if (!vecino || vecino.rol !== 'vecino') {
      return [null, 'Usuario no encontrado o no tiene rol de vecino'];
    }

    const cupones = await cuponRepository.find({
      where: { vecino: { id: idVecino } },
      relations: ['vecino'],
    });

    return [cupones, null];
  } catch (error) {
    return [null, `Error al obtener cupones del vecino: ${error.message}`];
  }
}