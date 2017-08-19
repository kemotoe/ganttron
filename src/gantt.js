// requiring fs (filesystem) from node and remote from electron
const fs = require('fs');
const { dialog } = require('electron').remote;

// creating a template for the 'buttons' section of the grid
const colHeader = '<div class="gantt_grid_head_cell gantt_grid_head_add" onclick="gantt.createTask()"></div>',
  colContent = task => `<i class="fa gantt_button_grid gantt_grid_edit fa-pencil" onclick="clickGridButton(${task.id}, 'edit')"></i>
            <i class="fa gantt_button_grid gantt_grid_add fa-plus" onclick="clickGridButton(${task.id}, 'add')"></i>
            <i class="fa gantt_button_grid gantt_grid_delete fa-times" onclick="clickGridButton(${task.id}, 'delete')"></i>`;

// configuring the columns within the grid
// | overdue icon | Task Name | Start Time | Deadline | Duration | Buttons (edit, add, delete)
gantt.config.columns = [
  {
    name: 'overdue',
    label: '',
    width: 30,
    template: (obj) => {
      if (obj.deadline) {
        const deadline = gantt.date.parseDate(obj.deadline, 'xml_date');
        if (deadline && obj.end_date > deadline) {
          return '<div class="overdue-indicator">!</div>';
        }
        if (deadline && obj.end_date <= deadline) {
          return '<div class="not-overdue">!</div>';
        }
      }
      return '<div></div>';
    },
  },
  { name: 'text', label: 'Task Name', width: '*', tree: true, resize: true },
  { name: 'start_date', label: 'Start Time', align: 'center', width: '80' },
  { name: 'deadline', label: 'Deadline', align: 'center', width: '80', template: (obj) => { if (!obj.deadline) { return 'None'; } return obj.deadline; } },
  { name: 'duration', label: 'Duration', align: 'center', width: '60' },
  { name: 'buttons', label: colHeader, width: 75, template: colContent },
];

// custom grid width
gantt.config.grid_width = 500;

// logic for applying the deadline icon on the task
gantt.addTaskLayer((task) => {
  if (task.deadline) {
    const element = document.createElement('div');
    element.className = 'deadline';
    const sizes = gantt.getTaskPosition(task, task.deadline);

    element.style.left = `${sizes.left}px`;
    element.style.top = `${sizes.top}px`;

    element.setAttribute('title', gantt.templates.task_date(task.deadline));
    return element;
  }
  return false;
});

// displaying progress % on left side of task
gantt.templates.progress_text = (start, end, task) => (
    `<span style='text-align:left;'>${Math.round(task.progress * 100)}% </span>`
  );

// logic for determing if a task is overdue
gantt.templates.task_class = (start, end, task) => {
  if (task.deadline && end.valueOf() > task.deadline.valueOf()) {
    return 'overdue';
  }
};

// painting overdue text + number of days overdue on the right side of a task
gantt.templates.rightside_text = (start, end, task) => {
  if (task.deadline) {
    if (end.valueOf() > task.deadline.valueOf()) {
      const overdue = Math.ceil(
        Math.abs(
          (end.getTime() - task.deadline.getTime()) / (24 * 60 * 60 * 1000),
        ),
      );
      const text = `<b>Overdue: ${overdue} day(s)</b>`;
      return text;
    }
  }
};

// parses the date of the deadline and if the task has one and returns true
gantt.attachEvent('onTaskLoading', (task) => {
  if (task.deadline) {
    task.deadline = gantt.date.parseDate(task.deadline, 'xml_date');
  }
  return true;
});

// custom labels for the deadline field and set/remove button in the lightbox
gantt.locale.labels.deadline_enable_button = 'Set';
gantt.locale.labels.deadline_disable_button = 'Remove';
gantt.locale.labels.section_deadline = 'Deadline';

// caculating the task duration for the lightbox
const duration = (begin, end, total) => {
  const result = gantt.calculateDuration(
    begin.getDate(false),
    end.getDate(false),
  );
  total.innerHTML = `${result} days`;
  gantt.attachEvent('onAfterLightBox', () => {
    total.innerHTML = '';
  });
};

// initializing the calendar component for time selection
const calendarInit = (id, data, date) => {
  const object = new dhtmlXCalendarObject(id);
  object.setDateFormat(data.date_format ? data.date_format : '');
  object.setDate(date || new Date());
  object.hideTime();
  if (data.skin) {
    object.setSkin(data.skin);
  }
  return object;
};

// creating the custom calendar element
// TODO: put icon in text field
gantt.form_blocks.dhx_calendar = {
  render: () => `<div class='dhx_calendar_cont'><input type='text' readonly='true' id='calendar1'/> &#8211
                  <input type='text' readonly='true' id='calendar2'/><label id='duration'></label></div>`,
  set_value: (node, value, task, data) => {
    let a = (node.calStart = calendarInit('calendar1', data, task.start_date));
    let b = (node.calEnd = calendarInit('calendar2', data, task.end_date));
    const c = node.lastChild;
    b.setInsensitiveRange(null, new Date(a.getDate(false) - 86400000));
    const aClick = a.attachEvent('onClick', (date) => {
      b.setInsensitiveRange(null, new Date(date.getTime() - 86400000));
      duration(a, b, c);
    });

    const bClick = b.attachEvent('onClick', (date) => {
      duration(a, b, c);
    });

    const aTimeClick = a.attachEvent('onChange', (d) => {
      b.setInsensitiveRange(null, new Date(d.getTime() - 86400000));
      duration(a, b, c);
    });

    const bTimeClick = b.attachEvent('onChange', (d) => {
      duration(a, b, c);
    });

    const id = gantt.attachEvent('onAfterLightbox', function detach() {
      a.detachEvent(aClick);
      a.detachEvent(aTimeClick);
      a.unload();
      b.detachEvent(bClick);
      b.detachEvent(bTimeClick);
      b.unload();
      a = b = null;
      this.detachEvent(id);
    });

    document.getElementById('calendar1').value = a.getDate(true);
    document.getElementById('calendar2').value = b.getDate(true);
  },
  get_value: (node, task) => {
    task.start_date = node.calStart.getDate(false);
    task.end_date = node.calEnd.getDate(false);
    return task;
  },
  focus: (node) => {},
};

// TODO: render a calendar for deadline input
gantt.form_blocks.dhx_calendar2 = {

};

// configuring the lightbox fields
gantt.config.lightbox.sections = [
  {
    name: 'description',
    height: 70,
    map_to: 'text',
    type: 'textarea',
    focus: true,
  },
  {
    name: 'time',
    map_to: 'auto',
    type: 'dhx_calendar',
    skin: '',
    date_format: '%d %M %Y',
  },
  {
    name: 'deadline',
    map_to: { start_date: 'deadline' },
    type: 'duration_optional',
    button: true,
    single_date: true,
  },
];

// configuring the time scale for the gantt chart may refactor in the future
// top level month, year
gantt.config.scale_unit = 'month';
gantt.config.step = 1;
gantt.config.date_scale = '%F, %Y';
// second level day, numeric day number
gantt.config.subscales = [{ unit: 'day', step: 1, date: '%D, %d' }];
// scale the height of the time scale
gantt.config.scale_height = 80;

// configuration to make the chart time scale scale as tasks are added
gantt.config.fit_tasks = true;

// configuration that allows tasks in the grid to be DnD and reconfigurable
gantt.config.order_branch = true;
gantt.config.order_branch_free = true;

// Ignoring weekends non functional without pro TODO: will have to roll my own
gantt.ignore_time = (date) => {
  if (date.getDay() === 0 || date.getDay() === 6) return true;
  return false;
};

// initialize the configured gantt chart
gantt.init('gantt');

// event handlers for when a user clicks on one of the buttons in the grid
const clickGridButton = (id, action) => {
  switch (action) {
    case 'edit':
      gantt.showLightbox(id);
      break;
    case 'add':
      gantt.createTask(null, id);
      break;
    case 'delete':
      gantt.confirm({
        title: gantt.locale.labels.confirm_deleting_title,
        text: gantt.locale.labels.confirm_deleting,
        callback: (res) => {
          if (res) gantt.deleteTask(id);
        },
      });
      break;
    default:
  }
};

// function that clears all tasks from current gantt
const clearGantt = () => {
  dialog.showMessageBox(
    {
      type: 'warning',
      title: 'Ganttron',
      message: 'This will clear the gantt chart and erase all data',
      buttons: ['Cancel', 'OK'],
    },
    (response) => {
      if (response === 1) {
        gantt.clearAll();
      }
    },
  );
};

// function that takes a name parameter from onclick and loads the correct stylesheet
// and replaces it
const changeSkin = (name) => {
  const link = document.createElement('link');
  link.onload = () => {
    gantt.resetSkin();
    gantt.config.scale_height = 80;
    gantt.render();
  };
  link.rel = 'stylesheet';
  link.type = 'text/css';
  link.id = 'skin';
  link.href = `../src/codebase/skins/dhtmlxgantt_${name}.css`;
  document.head.replaceChild(link, document.querySelector('#skin'));
};

// function for saving a gantt project projects are serialized into a JSON file
// the JSON is then stringified for human readiblity then thru the dialog api is saved to
// users computer
const saveGantt = () => {
  const savedGantt = gantt.serialize();
  const content = JSON.stringify(savedGantt, null, '\t');
  dialog.showSaveDialog(
    {
      defaultPath: `C:\\Users\\${process.env.USERNAME}\\Documents\\`,
      filters: [
        {
          name: 'json',
          extensions: ['json'],
        },
      ],
    },
    (filename) => {
      if (filename === undefined) {
        return;
      }
      fs.writeFile(filename, content, (err) => {
        if (err) {
          dialog.showErrorBox(
            'Save Failed',
            `An error occured saving the file ${err.message}`,
          );
          return;
        }
        dialog.showMessageBox({
          type: 'none',
          title: 'Ganttron',
          message: 'The file was successfully saved',
          buttons: ['OK'],
        });
      });
    },
  );
};

// function that loads a gantt project uses the dialog api to open a JSON file from
// the users computer then it is parsed to return a JSON object that is then parsed by
// the gantt api
const loadGantt = () => {
  dialog.showMessageBox(
    {
      type: 'warning',
      title: 'Ganttron',
      message: 'This will clear the gantt chart and load new data',
      buttons: ['Cancel', 'OK'],
    },
    (response) => {
      if (response === 1) {
        gantt.clearAll();
        dialog.showOpenDialog(
          {
            defaultPath: `C:\\Users\\${process.env.USERNAME}\\Documents`,
            filters: [
              {
                name: 'json',
                extensions: ['json'],
              },
            ],
          },
          (fileName) => {
            if (fileName === undefined) {
              return;
            }
            fs.readFile(fileName[0], 'utf-8', (err, data) => {
              if (err) {
                dialog.showErrorBox(
                  'Load Failed',
                  `Cannot read file ${err.message}`,
                );
              }
              const loadedData = JSON.parse(data);
              gantt.parse(loadedData);
            });
          },
        );
      }
    },
  );
};
