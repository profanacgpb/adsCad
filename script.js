"use strict";

const STORAGE_KEY = "adsCad.estudantes";

const form = document.querySelector("#student-form");
const studentList = document.querySelector("#student-list");
const feedback = document.querySelector("#feedback");
const searchInput = document.querySelector("#search");
const courseFilter = document.querySelector("#course-filter");
const classFilter = document.querySelector("#class-filter");
const statusFilter = document.querySelector("#status-filter");
const emptyState = document.querySelector("#empty-state");
const saveButton = document.querySelector("#save-button");
const cancelEditButton = document.querySelector("#cancel-edit");
const registrationInput = document.querySelector("#registration");
const enrollmentDateInput = document.querySelector("#enrollment-date");

let students = [];
let feedbackTimer;

function showFeedback(message, type = "success") {
    window.clearTimeout(feedbackTimer);
    feedback.textContent = message;
    feedback.className = `feedback ${type}`;
    feedback.hidden = false;
    feedback.scrollIntoView({ behavior: "smooth", block: "nearest" });
    feedbackTimer = window.setTimeout(() => {
        feedback.hidden = true;
    }, 6000);
}

function loadStudents() {
    try {
        const stored = window.localStorage.getItem(STORAGE_KEY);
        if (stored === null) return [];
        const parsed = JSON.parse(stored);
        if (!Array.isArray(parsed) || parsed.some((student) =>
            !student || typeof student !== "object" || typeof student.id !== "string"
        )) {
            throw new Error("Os dados salvos não possuem o formato esperado.");
        }
        return parsed;
    } catch (error) {
        showFeedback(`Não foi possível carregar os estudantes salvos. ${error.message}`, "error");
        form.querySelector('[type="submit"]').disabled = true;
        return [];
    }
}

function persistStudents(nextStudents) {
    try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextStudents));
        students = nextStudents;
        render();
        return true;
    } catch (error) {
        showFeedback(`Não foi possível salvar as alterações neste navegador. ${error.message}`, "error");
        return false;
    }
}

function formatDate(dateString) {
    if (!dateString) return "—";
    const [year, month, day] = dateString.split("-");
    return `${day}/${month}/${year}`;
}

function todayString() {
    const now = new Date();
    const localDate = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
    return localDate.toISOString().slice(0, 10);
}

function generateRegistration() {
    const usedNumbers = new Set(students.map((student) => student.registration));
    let number = students.reduce((highest, student) => {
        const match = /^EST-(\d+)$/.exec(student.registration || "");
        return match ? Math.max(highest, Number(match[1])) : highest;
    }, 0) + 1;
    let registration = `EST-${String(number).padStart(6, "0")}`;
    while (usedNumbers.has(registration)) {
        number += 1;
        registration = `EST-${String(number).padStart(6, "0")}`;
    }
    return registration;
}

function isValidCPF(value) {
    const cpf = value.replace(/\D/g, "");
    if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;

    const calculateDigit = (slice, weight) => {
        const sum = slice.split("").reduce((total, digit, index) =>
            total + Number(digit) * (weight - index), 0);
        const remainder = (sum * 10) % 11;
        return remainder === 10 ? 0 : remainder;
    };

    return calculateDigit(cpf.slice(0, 9), 10) === Number(cpf[9])
        && calculateDigit(cpf.slice(0, 10), 11) === Number(cpf[10]);
}

function maskCPF(value) {
    const digits = value.replace(/\D/g, "").slice(0, 11);
    return digits
        .replace(/^(\d{3})(\d)/, "$1.$2")
        .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
        .replace(/\.(\d{3})(\d)/, ".$1-$2");
}

function maskPhone(value) {
    const digits = value.replace(/\D/g, "").slice(0, 11);
    if (digits.length < 3) return digits ? `(${digits}` : "";
    if (digits.length < 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    const prefix = `(${digits.slice(0, 2)}) `;
    return digits.length <= 10
        ? `${prefix}${digits.slice(2, 6)}-${digits.slice(6)}`
        : `${prefix}${digits.slice(2, 7)}-${digits.slice(7)}`;
}

function updateSummary() {
    document.querySelector("#total-count").textContent = String(students.length);
    document.querySelector("#active-count").textContent =
        String(students.filter((student) => student.status === "ativo").length);
    document.querySelector("#inactive-count").textContent =
        String(students.filter((student) => student.status === "inativo").length);
}

function updateFilterOptions(select, property, defaultLabel, currentValue) {
    const uniqueValues = [...new Set(students.map((student) => student[property]).filter(Boolean))]
        .sort((a, b) => a.localeCompare(b, "pt-BR"));
    select.replaceChildren(new Option(defaultLabel, ""));
    uniqueValues.forEach((value) => select.add(new Option(value, value)));
    select.value = uniqueValues.includes(currentValue) ? currentValue : "";
}

function getVisibleStudents() {
    const query = searchInput.value.trim().toLocaleLowerCase("pt-BR");
    return students.filter((student) => {
        const matchesSearch = !query || [student.name, student.registration, student.cpf]
            .some((value) => (value || "").toLocaleLowerCase("pt-BR").includes(query));
        return matchesSearch
            && (!courseFilter.value || student.course === courseFilter.value)
            && (!classFilter.value || student.className === classFilter.value)
            && (!statusFilter.value || student.status === statusFilter.value);
    });
}

function appendCell(row, className, content) {
    const cell = document.createElement("td");
    if (className) cell.className = className;
    if (content instanceof Node) cell.append(content);
    else cell.textContent = content;
    row.append(cell);
    return cell;
}

function makeStudentCell(student) {
    const container = document.createElement("div");
    const name = document.createElement("span");
    name.className = "student-name";
    name.textContent = student.name;
    const details = document.createElement("span");
    details.className = "student-detail";
    details.textContent = `CPF ${student.cpf} · Nasc. ${formatDate(student.birthDate)}`;
    container.append(name, details);
    return container;
}

function makeCourseCell(student) {
    const container = document.createElement("div");
    const course = document.createElement("span");
    course.className = "student-name";
    course.textContent = student.course;
    const className = document.createElement("span");
    className.className = "student-detail";
    className.textContent = student.className;
    container.append(course, className);
    return container;
}

function makeContactCell(student) {
    const container = document.createElement("div");
    const email = document.createElement("span");
    email.textContent = student.email;
    const phone = document.createElement("span");
    phone.className = "student-detail";
    phone.textContent = student.phone;
    container.append(email, phone);
    return container;
}

function makeActionButton(label, className, action, studentId) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `icon-button ${className}`.trim();
    button.textContent = label;
    button.setAttribute("aria-label", `${label} estudante`);
    button.dataset.action = action;
    button.dataset.id = studentId;
    return button;
}

function renderStudents() {
    const visibleStudents = getVisibleStudents();
    studentList.replaceChildren();

    visibleStudents.forEach((student) => {
        const row = document.createElement("tr");
        appendCell(row, "", makeStudentCell(student));
        appendCell(row, "registration-cell", student.registration);
        appendCell(row, "", makeCourseCell(student));
        appendCell(row, "contact-cell", makeContactCell(student));

        const status = document.createElement("span");
        status.className = `status-badge ${student.status === "ativo" ? "status-active" : "status-inactive"}`;
        status.textContent = student.status === "ativo" ? "Ativo" : "Inativo";
        appendCell(row, "", status);

        const actions = document.createElement("div");
        actions.className = "row-actions";
        actions.append(
            makeActionButton("Editar", "", "edit", student.id),
            makeActionButton("Excluir", "delete", "delete", student.id)
        );
        appendCell(row, "", actions);
        studentList.append(row);
    });

    document.querySelector("#result-count").textContent =
        `${visibleStudents.length} ${visibleStudents.length === 1 ? "registro" : "registros"}`;

    const hasFilters = Boolean(searchInput.value || courseFilter.value || classFilter.value || statusFilter.value);
    if (visibleStudents.length === 0) {
        document.querySelector("#empty-title").textContent =
            students.length === 0 ? "Nenhum estudante cadastrado" : "Nenhum resultado encontrado";
        document.querySelector("#empty-description").textContent = students.length === 0
            ? "Preencha o formulário acima para adicionar o primeiro estudante."
            : hasFilters
                ? "Tente ajustar a pesquisa ou os filtros para encontrar um estudante."
                : "Cadastre um estudante para que ele apareça nesta lista.";
        emptyState.hidden = false;
    } else {
        emptyState.hidden = true;
    }
}

function render() {
    updateSummary();
    updateFilterOptions(courseFilter, "course", "Todos os cursos", courseFilter.value);
    updateFilterOptions(classFilter, "className", "Todas as turmas", classFilter.value);
    renderStudents();
}

function resetForm() {
    form.reset();
    document.querySelector("#student-id").value = "";
    registrationInput.value = "";
    enrollmentDateInput.value = todayString();
    document.querySelector("#form-title").textContent = "Cadastrar estudante";
    saveButton.textContent = "Cadastrar estudante";
    cancelEditButton.hidden = true;
}

function getFormStudent() {
    return {
        id: document.querySelector("#student-id").value || crypto.randomUUID(),
        name: document.querySelector("#full-name").value.trim(),
        cpf: maskCPF(document.querySelector("#cpf").value),
        birthDate: document.querySelector("#birth-date").value,
        email: document.querySelector("#email").value.trim(),
        phone: maskPhone(document.querySelector("#phone").value),
        address: document.querySelector("#address").value.trim(),
        registration: registrationInput.value || generateRegistration(),
        enrollmentDate: enrollmentDateInput.value || todayString(),
        course: document.querySelector("#course").value.trim(),
        className: document.querySelector("#class-name").value.trim(),
        status: document.querySelector("#status").value
    };
}

function validateStudent(student) {
    const requiredFields = [
        ["Nome completo", student.name],
        ["CPF", student.cpf],
        ["Data de nascimento", student.birthDate],
        ["E-mail", student.email],
        ["Telefone", student.phone],
        ["Endereço", student.address],
        ["Curso", student.course],
        ["Turma", student.className],
        ["Situação", student.status]
    ];
    const missingField = requiredFields.find(([, value]) => !value);
    if (missingField) return `Preencha o campo obrigatório: ${missingField[0]}.`;
    if (!isValidCPF(student.cpf)) return "Informe um CPF válido.";
    if (!form.reportValidity()) return "Confira os campos destacados e informe um e-mail válido.";
    if (new Date(`${student.birthDate}T00:00:00`) > new Date(`${todayString()}T00:00:00`)) {
        return "A data de nascimento não pode ser futura.";
    }
    if (students.some((existing) => existing.cpf === student.cpf && existing.id !== student.id)) {
        return "Já existe um estudante cadastrado com este CPF.";
    }
    if (students.some((existing) =>
        existing.registration === student.registration && existing.id !== student.id
    )) {
        return "Esta matrícula já está vinculada a outro estudante.";
    }
    return "";
}

form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!form.reportValidity()) {
        showFeedback("Confira os campos obrigatórios e o formato do e-mail.", "error");
        return;
    }

    const student = getFormStudent();
    const validationMessage = validateStudent(student);
    if (validationMessage) {
        showFeedback(validationMessage, "error");
        return;
    }

    const editing = Boolean(document.querySelector("#student-id").value);
    const nextStudents = editing
        ? students.map((current) => current.id === student.id ? student : current)
        : [...students, student];

    if (persistStudents(nextStudents)) {
        resetForm();
        showFeedback(editing ? "Cadastro do estudante atualizado com sucesso." : "Estudante cadastrado com sucesso.");
    }
});

function beginEdit(studentId) {
    const student = students.find((item) => item.id === studentId);
    if (!student) {
        showFeedback("Não foi possível localizar este estudante.", "error");
        return;
    }

    document.querySelector("#student-id").value = student.id;
    document.querySelector("#full-name").value = student.name;
    document.querySelector("#cpf").value = student.cpf;
    document.querySelector("#birth-date").value = student.birthDate;
    document.querySelector("#email").value = student.email;
    document.querySelector("#phone").value = student.phone;
    document.querySelector("#address").value = student.address;
    registrationInput.value = student.registration;
    enrollmentDateInput.value = student.enrollmentDate;
    document.querySelector("#course").value = student.course;
    document.querySelector("#class-name").value = student.className;
    document.querySelector("#status").value = student.status;
    document.querySelector("#form-title").textContent = "Editar estudante";
    saveButton.textContent = "Salvar alterações";
    cancelEditButton.hidden = false;
    document.querySelector("#formulario").scrollIntoView({ behavior: "smooth" });
    document.querySelector("#full-name").focus({ preventScroll: true });
}

studentList.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-action]");
    if (!button) return;

    if (button.dataset.action === "edit") {
        beginEdit(button.dataset.id);
        return;
    }

    const student = students.find((item) => item.id === button.dataset.id);
    if (!student) {
        showFeedback("Não foi possível localizar este estudante.", "error");
        return;
    }
    if (!window.confirm(`Deseja excluir o cadastro de ${student.name}? Esta ação não pode ser desfeita.`)) {
        return;
    }

    if (persistStudents(students.filter((item) => item.id !== student.id))) {
        if (document.querySelector("#student-id").value === student.id) resetForm();
        showFeedback("Cadastro do estudante excluído com sucesso.");
    }
});

document.querySelector("#cpf").addEventListener("input", (event) => {
    event.target.value = maskCPF(event.target.value);
});
document.querySelector("#phone").addEventListener("input", (event) => {
    event.target.value = maskPhone(event.target.value);
});

form.addEventListener("reset", () => {
    window.setTimeout(() => {
        document.querySelector("#student-id").value = "";
        registrationInput.value = "";
        enrollmentDateInput.value = todayString();
        document.querySelector("#form-title").textContent = "Cadastrar estudante";
        saveButton.textContent = "Cadastrar estudante";
        cancelEditButton.hidden = true;
    });
});

cancelEditButton.addEventListener("click", () => {
    resetForm();
    showFeedback("Edição cancelada. Nenhuma alteração foi salva.");
});

searchInput.addEventListener("input", renderStudents);
courseFilter.addEventListener("change", renderStudents);
classFilter.addEventListener("change", renderStudents);
statusFilter.addEventListener("change", renderStudents);
document.querySelector("#clear-filters").addEventListener("click", () => {
    searchInput.value = "";
    courseFilter.value = "";
    classFilter.value = "";
    statusFilter.value = "";
    renderStudents();
});

enrollmentDateInput.value = todayString();
students = loadStudents();
render();
