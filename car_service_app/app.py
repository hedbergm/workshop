from datetime import datetime
from functools import wraps
from flask import Flask, render_template, request, redirect, url_for, session, flash
from models import db, Vehicle, ServiceEntry


def create_app():
    app = Flask(__name__)
    app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///database.sqlite3'
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    app.config['SECRET_KEY'] = 'dev-secret-change'

    db.init_app(app)

    with app.app_context():
        db.create_all()

    # --- Auth helpers ---
    def login_required(view):
        @wraps(view)
        def wrapped(*args, **kwargs):
            if not session.get('user'):
                return redirect(url_for('login'))
            return view(*args, **kwargs)
        return wrapped

    # --- Routes ---
    @app.route('/', methods=['GET', 'POST'])
    def login():
        if request.method == 'POST':
            username = request.form.get('username', '')
            password = request.form.get('password', '')
            if username == 'Admin' and password == 'Admin':
                session['user'] = 'Admin'
                return redirect(url_for('list_vehicles'))
            flash('Feil brukernavn eller passord')
        return render_template('login.html')

    @app.route('/logout')
    def logout():
        session.clear()
        return redirect(url_for('login'))

    @app.route('/vehicles')
    @login_required
    def list_vehicles():
        vehicles = Vehicle.query.order_by(Vehicle.created_at.desc()).all()
        # Compute totals on the fly to ensure correctness
        totals = {v.id: sum(e.cost for e in v.entries) for v in vehicles}
        return render_template('vehicles.html', vehicles=vehicles, totals=totals)

    @app.route('/vehicles/new', methods=['GET', 'POST'])
    @login_required
    def new_vehicle():
        if request.method == 'POST':
            try:
                v = Vehicle(
                    regnr=request.form['regnr'].strip().upper(),
                    make=request.form['make'].strip(),
                    vtype=request.form['vtype'].strip(),
                    model=request.form['model'].strip(),
                    purchase_price=float(request.form['purchase_price']) if request.form['purchase_price'] else None,
                )
                db.session.add(v)
                db.session.commit()
                flash('Bil registrert')
                return redirect(url_for('list_vehicles'))
            except Exception as ex:
                db.session.rollback()
                flash(f'Kunne ikke registrere bil: {ex}')
        return render_template('vehicle_new.html')

    @app.route('/vehicles/<int:vehicle_id>')
    @login_required
    def vehicle_detail(vehicle_id: int):
        v = Vehicle.query.get_or_404(vehicle_id)
        total_cost = sum(e.cost for e in v.entries)
        return render_template('vehicle_detail.html', v=v, total_cost=total_cost)

    @app.route('/vehicles/<int:vehicle_id>/add_entry', methods=['POST'])
    @login_required
    def add_entry(vehicle_id: int):
        v = Vehicle.query.get_or_404(vehicle_id)
        try:
            date_str = request.form.get('date')
            date_val = datetime.strptime(date_str, '%Y-%m-%d').date() if date_str else datetime.utcnow().date()
            entry = ServiceEntry(
                vehicle_id=v.id,
                date=date_val,
                category=request.form.get('category') or 'service',
                description=request.form.get('description', '').strip(),
                cost=float(request.form.get('cost') or 0),
                odometer=int(request.form.get('odometer') or 0),
            )
            db.session.add(entry)
            db.session.commit()
            flash('Service/reparasjon lagt til')
        except Exception as ex:
            db.session.rollback()
            flash(f'Kunne ikke legge til oppføring: {ex}')
        return redirect(url_for('vehicle_detail', vehicle_id=vehicle_id))

    @app.route('/vehicles/<int:vehicle_id>/sell', methods=['POST'])
    @login_required
    def sell_vehicle(vehicle_id: int):
        v = Vehicle.query.get_or_404(vehicle_id)
        try:
            v.sale_price = float(request.form.get('sale_price')) if request.form.get('sale_price') else None
            v.sold_date = datetime.utcnow()
            db.session.commit()
            flash('Utsalgspris registrert')
        except Exception as ex:
            db.session.rollback()
            flash(f'Kunne ikke oppdatere utsalgspris: {ex}')
        return redirect(url_for('vehicle_detail', vehicle_id=vehicle_id))

    return app


if __name__ == '__main__':
    app = create_app()
    app.run(host='127.0.0.1', port=5000, debug=True)
